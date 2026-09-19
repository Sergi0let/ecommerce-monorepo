import { z } from 'zod';

export const ImageProcessingConfigSchema = z.object({
  IMAGE_MAX_FILE_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10_485_760),
  IMAGE_MAX_INPUT_PIXELS: z.coerce
    .number()
    .int()
    .positive()
    .default(40_000_000),
  IMAGE_PROCESSING_CONCURRENCY: z.coerce.number().int().positive().default(2),
});

export const ImageInputMetadataSchema = z.object({
  format: z.enum(['jpeg', 'png', 'webp']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  pages: z.literal(1).default(1),
  animated: z.literal(false),
});

export type ImageProcessingConfigType = z.infer<
  typeof ImageProcessingConfigSchema
>;
