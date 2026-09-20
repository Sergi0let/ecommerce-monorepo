import { z } from 'zod';
import { UuidSchema } from '../../common/index.js';

export const IMAGE_UPLOAD_COMMIT_WINDOW_MS = 5 * 60 * 1000;

export const ProductImageObjectKeySchema = z
  .string()
  .transform((key) => key.split('/'))
  .pipe(
    z.tuple([
      z.literal('products'),
      UuidSchema,
      UuidSchema,
      z.enum(['thumbnail.webp', 'medium.webp', 'large.webp']),
    ]),
  )
  .transform(([, productId, imageId]) => ({
    productId,
    imageId,
    storageKeyBase: `products/${productId}/${imageId}`,
  }));

export const ImageRecoveryOptionsSchema = z.strictObject({
  apply: z.boolean().default(false),
  removeBrokenRecords: z.boolean().default(false),
  graceHours: z.coerce.number().finite().min(1).max(8760).default(24),
});
export type ImageRecoveryOptionsType = z.infer<
  typeof ImageRecoveryOptionsSchema
>;
