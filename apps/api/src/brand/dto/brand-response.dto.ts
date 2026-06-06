export class BrandResponseDto {
  /**
   * ID brand
   * @example '123e4567-e89b-12d3-a456-426614174000'
   */
  id!: string;

  /**
   * Name of brand
   * @example 'Instytutum'
   */
  name!: string;

  /**
   * Slug of brand
   * @example 'instytutum'
   */
  slug!: string;

  /**
   * Description of brand
   * @example 'Instytutum is a brand that makes products for the skin'
   */
  description?: string;

  /**
   * URL of brand logo
   * @example 'https://instytutum.com/logo.png'
   */
  logo?: string;

  /**
   * Is brand active
   * @example true
   */
  isActive!: boolean;

  /**
   * Creation date of brand
   * @example '2021-01-01T00:00:00.000Z'
   */
  createdAt!: Date;

  /**
   * Update date of brand
   * @example '2021-01-01T00:00:00.000Z'
   */
  updatedAt?: Date;
}
