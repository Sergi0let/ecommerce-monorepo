import { WarehouseSchema } from '../schemas/index.js';

export const WarehouseSummarySchema = WarehouseSchema.pick({
  id: true,
  name: true,
  code: true,
  isDefault: true,
  isActive: true,
});
