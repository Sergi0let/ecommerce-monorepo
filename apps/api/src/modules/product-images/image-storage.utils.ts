import { ConflictException } from '@nestjs/common';
import { ProductImageObjectKeySchema } from '@repo/contracts';
import type { Prisma } from '@repo/database';

export const lockImageProduct = (
  transaction: Prisma.TransactionClient,
  productId: string,
) =>
  transaction.$queryRaw<
    Array<{ id: string }>
  >`SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE`;

export function imageObjectKeys(image: {
  id: string;
  productId: string;
  storageKeyBase: string;
}) {
  const keys = ['thumbnail', 'medium', 'large'].map(
    (name) => `${image.storageKeyBase}/${name}.webp`,
  );
  for (const key of keys) {
    const parsed = ProductImageObjectKeySchema.safeParse(key);
    if (
      !parsed.success ||
      parsed.data.imageId !== image.id ||
      parsed.data.productId !== image.productId
    ) {
      throw new ConflictException(
        'Image storage identity is invalid; manual repair required',
      );
    }
  }
  return keys;
}
