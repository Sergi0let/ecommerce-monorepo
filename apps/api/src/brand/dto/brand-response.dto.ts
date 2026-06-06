import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BrandResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'Instytutum' })
  name!: string;

  @ApiProperty({ example: 'instytutum' })
  slug!: string;

  @ApiPropertyOptional({ example: 'Professional skincare brand' })
  description?: string;

  @ApiPropertyOptional({ example: 'https://instytutum.com/logo.png' })
  logo?: string;

  @ApiPropertyOptional({ example: 'https://instytutum.com' })
  websiteUrl?: string;

  @ApiPropertyOptional({ example: 'Instytutum | Official Store' })
  metaTitle?: string;

  @ApiPropertyOptional({ example: 'Shop Instytutum cosmetics online' })
  metaDescription?: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2021-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({ example: '2021-01-01T00:00:00.000Z' })
  updatedAt?: Date;
}

export class BrandWithCountsDto extends BrandResponseDto {
  @ApiProperty({ example: { products: 10, categories: 4 } })
  _count!: { products: number; categories: number };
}
