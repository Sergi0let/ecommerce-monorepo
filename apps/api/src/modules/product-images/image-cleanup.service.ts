import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProductImageObjectKeySchema } from '@repo/contracts';
import type { Prisma } from '@repo/database';
import { setTimeout as delay } from 'node:timers/promises';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../common/storage/object-storage.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { imageObjectKeys, lockImageProduct } from './image-storage.utils';

type ImageIdentity = {
  id: string;
  productId: string;
  variantId: string | null;
  storageKeyBase: string;
};

@Injectable()
export class ImageCleanupService {
  private readonly logger = new Logger(ImageCleanupService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async enqueue(
    transaction: Prisma.TransactionClient,
    images: ImageIdentity[],
  ) {
    const data = images.flatMap((image) =>
      imageObjectKeys(image).map((key) => ({
        key,
        imageId: image.id,
        productId: image.productId,
        variantId: image.variantId,
      })),
    );
    if (data.length)
      await transaction.imageCleanupTask.createMany({
        data,
        skipDuplicates: true,
      });
  }

  async deleteImage(id: string) {
    const image = await this.prisma.client.productImage.findUnique({
      where: { id },
    });
    if (image) {
      await this.prisma.client.$transaction(
        async (transaction) => {
          await lockImageProduct(transaction, image.productId);
          const current = await transaction.productImage.findUnique({
            where: { id },
          });
          if (!current) return;
          await this.enqueue(transaction, [current]);
          await transaction.productImage.delete({ where: { id } });
        },
        { isolationLevel: 'ReadCommitted' },
      );
    }
    await this.drain({ imageId: id });
  }

  async drain(where: Prisma.ImageCleanupTaskWhereInput, throwOnFailure = true) {
    let cursor: string | undefined;
    let failed = 0;
    do {
      const tasks = await this.prisma.client.imageCleanupTask.findMany({
        where: { ...where, ...(cursor ? { key: { gt: cursor } } : {}) },
        orderBy: { key: 'asc' },
        take: 100,
      });
      if (!tasks.length) break;
      for (const task of tasks) if (!(await this.execute(task.key))) failed++;
      cursor = tasks.at(-1)?.key;
    } while (cursor);
    if (failed && throwOnFailure)
      throw new ServiceUnavailableException(
        'Deletion recorded; storage cleanup pending. Retry the request or run images:recover',
      );
    return failed;
  }

  async execute(key: string): Promise<boolean> {
    const parsed = ProductImageObjectKeySchema.safeParse(key);
    if (!parsed.success) {
      this.logger.error({
        message: 'Invalid cleanup key; manual repair required',
        key,
      });
      return false;
    }
    const identity = parsed.data;
    // Never erase a live reference, including soft-deleted products.
    const referenced = await this.prisma.client.productImage.findFirst({
      where: {
        OR: [
          { id: identity.imageId },
          { storageKeyBase: identity.storageKeyBase },
        ],
      },
    });
    if (referenced) {
      await this.prisma.client.imageCleanupTask.deleteMany({ where: { key } });
      this.logger.warn({
        message: 'Image cleanup skipped: live reference',
        key,
      });
      return true;
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.storage.deleteObject(key);
        await this.prisma.client.imageCleanupTask.deleteMany({
          where: { key },
        });
        this.logger.log({ message: 'Image cleanup completed', key, attempt });
        return true;
      } catch {
        this.logger.warn({
          message: 'Image cleanup attempt failed',
          key,
          attempt,
        });
        await this.prisma.client.imageCleanupTask.updateMany({
          where: { key },
          data: {
            attempts: { increment: 1 },
            nextAttemptAt: new Date(Date.now() + 60_000),
          },
        });
        if (attempt < 3) await delay(100 * 2 ** (attempt - 1));
      }
    }
    return false;
  }
}
