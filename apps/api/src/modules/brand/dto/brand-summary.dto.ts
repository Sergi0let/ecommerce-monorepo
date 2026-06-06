import { PickType } from '@nestjs/swagger';
import { BrandResponseDto } from './brand-response.dto';

export class BrandSummaryDto extends PickType(BrandResponseDto, [
  'id',
  'name',
  'slug',
  'logo',
  'isActive',
] as const) {}
