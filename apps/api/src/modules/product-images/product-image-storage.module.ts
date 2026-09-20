import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImageCleanupService } from './image-cleanup.service';
import { ImageRecoveryService } from './image-recovery.service';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [ImageCleanupService, ImageRecoveryService],
  exports: [ImageCleanupService, ImageRecoveryService],
})
export class ProductImageStorageModule {}
