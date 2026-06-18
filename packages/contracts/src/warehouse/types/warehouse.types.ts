import { z } from 'zod';
import { CreateWarehouseSchema } from '../inputs/create-warehouse-schema.js';
import { UpdateWarehouseSchema } from '../inputs/update-warehouse-schema.js';
import { WarehouseQuerySchema } from '../inputs/warehouse-query-schema.js';
import { WarehouseSummaryResponseSchema } from '../responses/warehouse-summary-response-schema.js';
import { WarehouseSummarySchema } from '../responses/warehouse-summary-schema.js';
import { WarehouseSchema } from '../schemas/warehouse-schema.js';

export type WarehouseType = z.infer<typeof WarehouseSchema>;
export type WarehouseSummaryType = z.infer<typeof WarehouseSummarySchema>;
export type WarehouseSummaryPageType = z.infer<
  typeof WarehouseSummaryResponseSchema
>;
export type WarehouseQueryType = z.infer<typeof WarehouseQuerySchema>;
export type CreateWarehouseType = z.infer<typeof CreateWarehouseSchema>;
export type CreateWarehouseInputType = z.input<typeof CreateWarehouseSchema>;
export type UpdateWarehouseType = z.infer<typeof UpdateWarehouseSchema>;
export type UpdateWarehouseInputType = z.input<typeof UpdateWarehouseSchema>;
