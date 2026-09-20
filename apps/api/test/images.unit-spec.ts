import { describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ImageProcessingConfigSchema } from '@repo/contracts';
import { crc32, deflateSync } from 'node:zlib';
import sharp from 'sharp';
import { ImageProcessorService } from '../src/common/images/image-processor.service';
import { ImagesModule } from '../src/common/images/images.module';
import { loadImageProcessingConfig } from '../src/common/images/images.config';

const defaults = ImageProcessingConfigSchema.parse({});
const processor = () => new ImageProcessorService(defaults);
const picture = (width = 64, height = 32) =>
  sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 180, g: 80, b: 40, alpha: 0.5 },
    },
  });

function pngChunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([header, body, checksum]);
}

// Two 1x1 RGBA frames, with valid PNG/APNG sequence numbers and checksums.
function animatedPng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const control = Buffer.alloc(8);
  control.writeUInt32BE(2);
  const frame = (sequence: number) => {
    const data = Buffer.alloc(26);
    data.writeUInt32BE(sequence, 0);
    data.writeUInt32BE(1, 4);
    data.writeUInt32BE(1, 8);
    data.writeUInt16BE(1, 20);
    data.writeUInt16BE(10, 22);
    return pngChunk('fcTL', data);
  };
  const sequence = Buffer.alloc(4);
  sequence.writeUInt32BE(2);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('acTL', control),
    frame(0),
    pngChunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))),
    frame(1),
    pngChunk(
      'fdAT',
      Buffer.concat([sequence, deflateSync(Buffer.from([0, 0, 255, 0, 255]))]),
    ),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('Image processing configuration', () => {
  it('uses defaults when optional env values are absent', () => {
    const config = new ConfigService();
    jest.spyOn(config, 'get').mockReturnValue(undefined);
    expect(loadImageProcessingConfig(config)).toEqual({
      IMAGE_MAX_FILE_SIZE_BYTES: 10_485_760,
      IMAGE_MAX_INPUT_PIXELS: 40_000_000,
      IMAGE_PROCESSING_CONCURRENCY: 2,
    });
  });

  it.each(Object.keys(defaults))(
    'validates %s as a positive integer',
    (key) => {
      for (const value of ['', 'invalid', '0', '-1', '1.5', 'Infinity']) {
        expect(
          ImageProcessingConfigSchema.safeParse({ [key]: value }).success,
        ).toBe(false);
      }
      expect(
        ImageProcessingConfigSchema.parse({ [key]: '3' })[
          key as keyof typeof defaults
        ],
      ).toBe(3);
    },
  );

  it('reports the invalid field without its value', () => {
    expect(() =>
      loadImageProcessingConfig(
        new ConfigService({
          ...defaults,
          IMAGE_MAX_INPUT_PIXELS: 'private-value',
        }),
      ),
    ).toThrow('Invalid image processing configuration: IMAGE_MAX_INPUT_PIXELS');
  });

  it('exports a singleton processor through Nest DI', async () => {
    const module = await Test.createTestingModule({ imports: [ImagesModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(defaults))
      .compile();
    try {
      expect(module.get(ImageProcessorService)).toBe(
        module.get(ImageProcessorService),
      );
      const output = await module
        .get(ImageProcessorService)
        .process(await picture().png().toBuffer());
      expect(output.large.width).toBe(64);
    } finally {
      await module.close();
    }
  });
});

describe('ImageProcessorService', () => {
  it.each([
    {
      width: 2000,
      height: 1000,
      expected: [
        [320, 160],
        [960, 480],
        [1600, 800],
      ],
    },
    {
      width: 1000,
      height: 2000,
      expected: [
        [160, 320],
        [480, 960],
        [800, 1600],
      ],
    },
    {
      width: 64,
      height: 32,
      expected: [
        [64, 32],
        [64, 32],
        [64, 32],
      ],
    },
  ])(
    'preserves aspect ratio and never enlarges $width x $height',
    async ({ width, height, expected }) => {
      const output = await processor().process(
        await picture(width, height).jpeg().toBuffer(),
      );
      expect(Object.keys(output)).toEqual(['thumbnail', 'medium', 'large']);
      expect(
        Object.values(output).map(({ width, height }) => [width, height]),
      ).toEqual(expected);
      for (const derivative of Object.values(output)) {
        const decoded = await sharp(derivative.buffer)
          .raw()
          .toBuffer({ resolveWithObject: true });
        expect(decoded.info.width).toBe(derivative.width);
        expect(decoded.info.height).toBe(derivative.height);
        expect((await sharp(derivative.buffer).metadata()).format).toBe('webp');
      }
    },
  );

  it.each(['jpeg', 'png', 'webp'] as const)(
    'accepts actual %s content without client MIME metadata',
    async (format) => {
      const input = await picture().toFormat(format).toBuffer();
      expect((await processor().process(input)).large.width).toBe(64);
    },
  );

  it('applies EXIF rotation before resizing and strips metadata', async () => {
    const input = await picture(1200, 600)
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const output = await processor().process(input);
    expect([output.thumbnail.width, output.thumbnail.height]).toEqual([
      160, 320,
    ]);
    expect([output.large.width, output.large.height]).toEqual([600, 1200]);
    for (const derivative of Object.values(output)) {
      const metadata = await sharp(derivative.buffer).metadata();
      for (const key of [
        'orientation',
        'exif',
        'icc',
        'xmp',
        'iptc',
      ] as const) {
        expect(metadata[key]).toBeUndefined();
      }
    }
  });

  it('preserves PNG transparency', async () => {
    const output = await processor().process(await picture().png().toBuffer());
    const { data, info } = await sharp(output.large.buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);
    expect(data[3]).toBeGreaterThan(0);
    expect(data[3]).toBeLessThan(255);
  });

  it.each([Buffer.alloc(0), Buffer.from('not an image')])(
    'rejects empty or unrecognised input',
    async (input) => {
      await expect(processor().process(input)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('rejects a truncated JPEG even when metadata can be read', async () => {
    const input = await picture(800, 800).jpeg().toBuffer();
    const truncated = input.subarray(0, input.length - 100);
    expect((await sharp(truncated).metadata()).format).toBe('jpeg');
    await expect(processor().process(truncated)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('enforces the byte limit, allowing its exact boundary', async () => {
    const input = await picture().png().toBuffer();
    const service = new ImageProcessorService({
      ...defaults,
      IMAGE_MAX_FILE_SIZE_BYTES: input.length,
    });
    await expect(
      service.process(Buffer.concat([input, Buffer.alloc(1)])),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    await expect(service.process(input)).resolves.toHaveProperty('large');
  });

  it('rejects excessive pixels even in a small compressed file', async () => {
    const input = await picture(101, 100).png().toBuffer();
    const service = new ImageProcessorService({
      ...defaults,
      IMAGE_MAX_INPUT_PIXELS: 10_000,
    });
    await expect(service.process(input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.process(await picture(100, 100).png().toBuffer()),
    ).resolves.toHaveProperty('large');
  });

  it.each(['gif', 'tiff'] as const)(
    'rejects valid %s files',
    async (format) => {
      await expect(
        processor().process(await picture().toFormat(format).toBuffer()),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('rejects SVG', async () => {
    const input = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    await expect(processor().process(input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects APNG instead of silently reading its first frame', async () => {
    const input = animatedPng();
    expect((await sharp(input).metadata()).format).toBe('png');
    await expect(processor().process(input)).rejects.toThrow(
      'Animated images are not supported',
    );
  });

  it('does not mistake PNG text containing acTL for animation', async () => {
    const input = await picture().png().toBuffer();
    const text = pngChunk('tEXt', Buffer.from('Comment\0acTL'));
    const withText = Buffer.concat([
      input.subarray(0, 33),
      text,
      input.subarray(33),
    ]);
    await expect(processor().process(withText)).resolves.toHaveProperty(
      'large',
    );
  });

  it('rejects truncated PNG chunks', async () => {
    const input = await picture().png().toBuffer();
    await expect(
      processor().process(input.subarray(0, 40)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects animated WebP', async () => {
    const pixels = Buffer.from([255, 0, 0, 255, 0, 255, 0, 255]);
    const input = await sharp(pixels, {
      raw: { width: 1, height: 2, channels: 4, pageHeight: 1 },
    })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    expect((await sharp(input).metadata()).pages).toBe(2);
    await expect(processor().process(input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects excess concurrent jobs and releases capacity after success', async () => {
    const input = await picture().png().toBuffer();
    const service = new ImageProcessorService({
      ...defaults,
      IMAGE_PROCESSING_CONCURRENCY: 2,
    });
    const first = service.process(input);
    const second = service.process(input);
    await expect(service.process(input)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await Promise.all([first, second]);
    await expect(service.process(input)).resolves.toHaveProperty('large');
  });

  it('releases capacity after decoding errors', async () => {
    const service = new ImageProcessorService({
      ...defaults,
      IMAGE_PROCESSING_CONCURRENCY: 1,
    });
    await expect(service.process(Buffer.from('broken'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.process(await picture().png().toBuffer()),
    ).resolves.toHaveProperty('large');
  });
});
