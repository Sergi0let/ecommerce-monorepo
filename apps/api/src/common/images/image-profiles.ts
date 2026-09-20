export const IMAGE_PROFILES = {
  thumbnail: 320,
  medium: 960,
  large: 1600,
} as const;

export const IMAGE_WEBP_QUALITY = 82;

export interface ImageDerivative {
  buffer: Buffer;
  width: number;
  height: number;
}

export type ProcessedImage = Record<
  keyof typeof IMAGE_PROFILES,
  ImageDerivative
>;
