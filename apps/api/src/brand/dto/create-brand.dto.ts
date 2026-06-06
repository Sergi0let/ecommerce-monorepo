import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBrandDto {
  /**
   * Назва бренду
   * @example 'Instytutum'
   */
  @IsString()
  @MinLength(3)
  @IsNotEmpty()
  name!: string;

  /**
   * Slug бренду
   * @example 'instytutum'
   */
  @IsString()
  @MinLength(3)
  @IsNotEmpty()
  slug!: string;

  /**
   * Опис бренду
   * @example 'Instytutum is a brand that makes products for the skin'
   */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  /**
   * URL логотипу бренду
   * @example 'https://instytutum.com/logo.png'
   */
  @IsString()
  @IsOptional()
  @IsUrl()
  @IsOptional()
  logo?: string;

  /**
   * URL веб-сайту бренду
   * @example 'https://instytutum.com'
   */
  @IsString()
  @IsUrl()
  @IsOptional()
  websiteUrl?: string;

  /**
   * Meta title бренду
   * @example 'Instytutum - Brand'
   */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  metaTitle?: string;

  /**
   * Meta description бренду
   * @example 'Instytutum is a brand that makes products for the skin'
   */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  metaDescription?: string;

  /**
   * Чи активний бренд
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: boolean }) => value ?? true)
  isActive?: boolean = true;
}
