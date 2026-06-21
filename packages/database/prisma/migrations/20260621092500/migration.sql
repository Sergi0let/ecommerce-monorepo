-- RenameForeignKey
ALTER TABLE "ProductImage" RENAME CONSTRAINT "ProductImage_variantId_fkey" TO "ProductImage_variantId_productId_fkey";
