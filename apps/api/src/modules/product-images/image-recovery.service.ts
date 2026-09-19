import { Inject, Injectable } from '@nestjs/common';
import type { ProductImage } from '@repo/database';
import {
  ImageRecoveryOptionsSchema,
  ProductImageObjectKeySchema,
  type ImageRecoveryOptionsType,
} from '@repo/contracts';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../common/storage/object-storage.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ImageCleanupService } from './image-cleanup.service';
import { imageObjectKeys } from './image-storage.utils';

export interface RecoveryEvent {
  kind:
    | 'pending-cleanup'
    | 'orphan'
    | 'missing-files'
    | 'invalid-identity'
    | 'failure';
  key?: string;
  imageId?: string;
  keys?: string[];
}

@Injectable()
export class ImageRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cleanup: ImageCleanupService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async run(
    input: ImageRecoveryOptionsType,
    report: (event: RecoveryEvent) => void,
  ) {
    const options = ImageRecoveryOptionsSchema.parse(input);
    const cutoff = new Date(Date.now() - options.graceHours * 3600_000);
    const due = new Date();
    let failures = 0;
    let cursor: string | undefined;
    // Cursor pagination bounds memory even for a large cleanup backlog.
    do {
      const tasks = await this.prisma.client.imageCleanupTask.findMany({
        where: {
          nextAttemptAt: { lte: due },
          ...(cursor ? { key: { gt: cursor } } : {}),
        },
        orderBy: { key: 'asc' },
        take: 100,
      });
      if (!tasks.length) break;
      for (const task of tasks) {
        report({ kind: 'pending-cleanup', key: task.key });
        if (options.apply && !(await this.cleanup.execute(task.key)))
          failures++;
      }
      cursor = tasks.at(-1)?.key;
    } while (cursor);

    cursor = undefined;
    do {
      const page = await this.storage.listObjects('products/', cursor);
      for (const object of page.objects) {
        const identity = ProductImageObjectKeySchema.safeParse(object.key);
        if (!identity.success || object.lastModified > cutoff) continue;
        if (
          await this.prisma.client.productImage.findFirst({
            where: {
              OR: [
                { id: identity.data.imageId },
                { storageKeyBase: identity.data.storageKeyBase },
              ],
            },
          })
        )
          continue;
        report({ kind: 'orphan', key: object.key });
        if (!options.apply) continue;
        // Re-read object age: LIST may be stale. New uploads cannot commit
        // after their 5-minute window; minimum recovery grace is one hour.
        const current = await this.storage.headObject(object.key);
        if (!current || current.lastModified > cutoff) continue;
        await this.prisma.client.imageCleanupTask.upsert({
          where: { key: object.key },
          update: {},
          create: {
            key: object.key,
            imageId: identity.data.imageId,
            productId: identity.data.productId,
          },
        });
        if (!(await this.cleanup.execute(object.key))) failures++;
      }
      if (page.cursor && page.cursor === cursor)
        throw new Error('Storage pagination did not advance');
      cursor = page.cursor;
    } while (cursor);

    cursor = undefined;
    do {
      const images: ProductImage[] =
        await this.prisma.client.productImage.findMany({
          where: {
            createdAt: { lte: cutoff },
            ...(cursor ? { id: { gt: cursor } } : {}),
          },
          orderBy: { id: 'asc' },
          take: 100,
        });
      if (!images.length) break;
      for (const image of images) {
        let keys: string[];
        try {
          keys = imageObjectKeys(image);
        } catch {
          report({ kind: 'invalid-identity', imageId: image.id });
          continue;
        }
        try {
          const missing: string[] = [];
          for (const key of keys)
            if (!(await this.storage.headObject(key))) missing.push(key);
          if (!missing.length) continue;
          report({ kind: 'missing-files', imageId: image.id, keys: missing });
          if (options.apply && options.removeBrokenRecords)
            await this.cleanup.deleteImage(image.id);
        } catch {
          failures++;
          report({ kind: 'failure', imageId: image.id });
        }
      }
      cursor = images.at(-1)?.id;
    } while (cursor);
    return { dryRun: !options.apply, failures };
  }
}
