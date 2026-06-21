import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

export const ProductPriceInputBaseSchema = z.object({
  productId: UuidSchema,
  variantId: UuidSchema.nullable().optional(),
  currency: z.string().length(3).default('UAH'),

  amountCents: z.number().int().positive(),
  costCents: z.number().int().nonnegative().nullable().optional(),
  compareAtCents: z.number().int().positive().nullable().optional(),

  isValidFrom: TimestampSchema.nullable().optional(),
  isValidTo: TimestampSchema.nullable().optional(),
});

export const CreateProductPriceSchema = ProductPriceInputBaseSchema.refine(
  (data) =>
    data.compareAtCents == null ||
    data.amountCents == null ||
    data.compareAtCents >= data.amountCents,
  {
    path: ['compareAtCents'],
    message: 'compareAtCents must be greater than or equal to amountCents',
  },
).refine(
  (data) =>
    data.isValidFrom == null ||
    data.isValidTo == null ||
    new Date(data.isValidFrom) <= new Date(data.isValidTo),
  {
    path: ['isValidTo'],
    message: 'isValidTo must be greater than or equal to isValidFrom',
  },
);
