import type { Prisma } from '@repo/database';

const catalogPriceSelect = {
  id: true,
  variantId: true,
  currency: true,
  amountCents: true,
  compareAtCents: true,
  isValidFrom: true,
  isValidTo: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PriceSelect;

export const getProductCatalogInclude = (now = new Date()) => {
  const activePriceWhere = {
    OR: [{ isValidFrom: null }, { isValidFrom: { lte: now } }],
    AND: [{ OR: [{ isValidTo: null }, { isValidTo: { gte: now } }] }],
  };

  return {
    images: {
      where: { variantId: null },
      orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
    },
    variants: {
      orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'asc' as const }],
      include: {
        prices: {
          select: catalogPriceSelect,
          where: activePriceWhere,
          orderBy: { isValidFrom: 'desc' as const },
          take: 1,
        },
        images: {
          orderBy: [
            { isPrimary: 'desc' as const },
            { sortOrder: 'asc' as const },
          ],
        },
      },
    },
  } satisfies Prisma.ProductInclude;
};
