import { z } from 'zod';

import { CreateInventorySchema } from '../inputs/create-inventory.schema.js';
import { UpdateInventorySchema } from '../inputs/update-inventory.schema.js';
import { InventorySchema } from '../schemas/inventory.schema.js';

export type InventoryType = z.infer<typeof InventorySchema>;
export type CreateInventoryType = z.infer<typeof CreateInventorySchema>;
export type CreateInventoryInputType = z.input<typeof CreateInventorySchema>;
export type UpdateInventoryType = z.infer<typeof UpdateInventorySchema>;
export type UpdateInventoryInputType = z.input<typeof UpdateInventorySchema>;
