import { ApiProperty } from '@nestjs/swagger';

export class BrandProductsPageDto {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  data!: unknown[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}
