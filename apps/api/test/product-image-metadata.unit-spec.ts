import { describe, expect, it } from '@jest/globals';
import {
  ImageRecoveryOptionsSchema,
  ProductImageObjectKeySchema,
} from '@repo/contracts';
import {
  UploadProductImageSchema,
  UpdateProductImagesSchema,
} from '@repo/contracts';

describe('Multipart product image metadata', () => {
  it('defaults recovery to dry run with a safe grace period', () => {
    expect(ImageRecoveryOptionsSchema.parse({})).toEqual({
      apply: false,
      removeBrokenRecords: false,
      graceHours: 24,
    });
    for (const graceHours of [0, -1, 0.5, 'invalid', Infinity]) {
      expect(ImageRecoveryOptionsSchema.safeParse({ graceHours }).success).toBe(
        false,
      );
    }
  });

  it('limits recovery to canonical UUID product-image derivative keys', () => {
    const base =
      'products/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002';
    expect(
      ProductImageObjectKeySchema.parse(`${base}/large.webp`).storageKeyBase,
    ).toBe(base);
    for (const key of [
      'products/manual.webp',
      `${base}/original.jpg`,
      `${base}/../large.webp`,
      'categories/a/b/large.webp',
    ]) {
      expect(ProductImageObjectKeySchema.safeParse(key).success).toBe(false);
    }
  });
  it('applies defaults for omitted fields', () => {
    expect(UploadProductImageSchema.parse({})).toEqual({
      sortOrder: 0,
      isPrimary: false,
    });
  });

  it.each(['true', 'false'])('parses the string %s explicitly', (value) => {
    expect(UploadProductImageSchema.parse({ isPrimary: value }).isPrimary).toBe(
      value === 'true',
    );
  });

  it('parses integer text and preserves alt text', () => {
    expect(
      UploadProductImageSchema.parse({ sortOrder: '12', alt: 'Front view' }),
    ).toEqual({ sortOrder: 12, alt: 'Front view', isPrimary: false });
  });

  it.each(['', ' ', '-1', '1.5', '1e2', '0x10', 'NaN', '2147483648'])(
    'rejects sortOrder %j',
    (value) => {
      expect(
        UploadProductImageSchema.safeParse({ sortOrder: value }).success,
      ).toBe(false);
    },
  );

  it.each([
    '',
    '0',
    '1',
    'False',
    'TRUE',
    'yes',
    false,
    ['false'],
    { value: 'false' },
  ])('rejects isPrimary %j', (value) => {
    expect(
      UploadProductImageSchema.safeParse({ isPrimary: value }).success,
    ).toBe(false);
  });

  it.each([
    'productId',
    'id',
    'storageKeyBase',
    'thumbnailUrl',
    'mediumUrl',
    'largeUrl',
    'width',
    'height',
    'unknown',
  ])('rejects client-controlled %s', (key) => {
    expect(UploadProductImageSchema.safeParse({ [key]: 'value' }).success).toBe(
      false,
    );
  });

  it.each(['', 'null', null, ['00000000-0000-4000-8000-000000000000']])(
    'rejects variantId %j',
    (variantId) => {
      expect(UploadProductImageSchema.safeParse({ variantId }).success).toBe(
        false,
      );
    },
  );

  it('keeps JSON updates typed and bounded by the PostgreSQL integer range', () => {
    expect(
      UpdateProductImagesSchema.parse({ alt: null, isPrimary: false }),
    ).toEqual({ alt: null, isPrimary: false });
    expect(
      UpdateProductImagesSchema.safeParse({ isPrimary: 'false' }).success,
    ).toBe(false);
    expect(
      UpdateProductImagesSchema.safeParse({ sortOrder: 2_147_483_648 }).success,
    ).toBe(false);
  });
});
