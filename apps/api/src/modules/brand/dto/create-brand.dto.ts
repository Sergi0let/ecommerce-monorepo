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
   * Name of the brand
   * @example 'Instytutum'
   */
  @IsString()
  @MinLength(3)
  @IsNotEmpty()
  name!: string;

  /**
   * Slug of the brand
   * @example 'instytutum'
   */
  @IsString()
  @MinLength(3)
  @IsNotEmpty()
  slug!: string;

  /**
   * Description of the brand
   * @example 'Instytutum is a brand that makes products for the skin'
   */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  /**
   * URL of the brand logo
   * @example 'https://instytutum.com/logo.png'
   */
  @IsString()
  @IsOptional()
  @IsUrl()
  logo?: string;

  /**
   * URL of the brand website
   * @example 'https://instytutum.com'
   */
  @IsString()
  @IsUrl()
  @IsOptional()
  websiteUrl?: string;

  /**
   * Meta title of the brand
   * @example 'Instytutum - Brand'
   */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  metaTitle?: string;

  /**
   * Meta description of the brand
   * @example 'Instytutum is a brand that makes products for the skin'
   */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  metaDescription?: string;

  /**
   * Whether the brand is active
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: boolean }) => value ?? true)
  isActive?: boolean = true;
}
