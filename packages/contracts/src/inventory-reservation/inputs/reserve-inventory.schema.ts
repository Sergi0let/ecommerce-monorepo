import { z } from 'zod';
import { UuidSchema } from '../../common/primitives.js';

export const ReserveInventoryItemSchema = z.strictObject({
  inventoryId: UuidSchema,
  quantity: z.number().int().positive(),
});

export const ReserveInventorySchema = z
  .strictObject({
    idempotencyKey: z.string().trim().min(1),
    items: z.array(ReserveInventoryItemSchema).min(1),
  })
  .superRefine(({ items }, context) => {
    const inventoryIds = new Set<string>();

    items.forEach(({ inventoryId }, index) => {
      if (inventoryIds.has(inventoryId)) {
        context.addIssue({
          code: 'custom',
          message: 'inventoryId must be unique within a reservation',
          path: ['items', index, 'inventoryId'],
        });
      }

      inventoryIds.add(inventoryId);
    });
  });
