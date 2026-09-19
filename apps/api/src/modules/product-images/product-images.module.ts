import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import type { ImageProcessingConfigType } from '@repo/contracts';
import { ImagesModule } from '../../common/images/images.module';
import { IMAGE_PROCESSING_CONFIG } from '../../common/images/images.config';
import { StorageModule } from '../../common/storage/storage.module';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProductImagesController } from './product-images.controller';
import { ProductImagesService } from './product-images.service';

@Module({
  imports: [
    StorageModule,
    ImagesModule,
    MulterModule.registerAsync({
      imports: [ImagesModule],
      inject: [IMAGE_PROCESSING_CONFIG],
      useFactory: (config: ImageProcessingConfigType) => ({
        // No destination/storage option: Multer uses memory storage.
        limits: {
          fileSize: config.IMAGE_MAX_FILE_SIZE_BYTES,
          files: 1,
          fields: 4,
          parts: 6,
          fieldSize: 4096,
          fieldNameSize: 100,
        },
      }),
    }),
  ],
  controllers: [ProductImagesController],
  providers: [ProductImagesService, JwtGuard, RolesGuard],
  exports: [ProductImagesService],
})
export class ProductImagesModule {}
