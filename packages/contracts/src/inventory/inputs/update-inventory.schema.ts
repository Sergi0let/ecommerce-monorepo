import { InventoryValuesInputSchema } from './create-inventory.schema.js';

export const UpdateInventorySchema =
  InventoryValuesInputSchema.partial().refine(
    (data) =>
      data.quantity === undefined ||
      data.reserved === undefined ||
      data.reserved <= data.quantity,
    {
      path: ['reserved'],
      message: 'reserved must be less than or equal to quantity',
    },
  );
