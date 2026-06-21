import { ProductPriceInputBaseSchema } from './create-product-price.schema.js';

export const UpdateProductPriceSchema = ProductPriceInputBaseSchema.partial()
  .refine(
    (data) =>
      data.compareAtCents == null ||
      data.amountCents == null ||
      data.compareAtCents >= data.amountCents,
    {
      path: ['compareAtCents'],
      message: 'compareAtCents must be greater than or equal to amountCents',
    },
  )
  .refine(
    (data) =>
      data.isValidFrom == null ||
      data.isValidTo == null ||
      new Date(data.isValidFrom) <= new Date(data.isValidTo),
    {
      path: ['isValidTo'],
      message: 'isValidTo must be greater than or equal to isValidFrom',
    },
  );
