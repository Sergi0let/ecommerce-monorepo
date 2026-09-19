import { Module } from '@nestjs/common';
import { ImagesModule } from '../../common/images/images.module';
import { StorageModule } from '../../common/storage/storage.module';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProductImagesController } from './product-images.controller';
import { ProductImagesService } from './product-images.service';

@Module({
  imports: [StorageModule, ImagesModule],
  controllers: [ProductImagesController],
  providers: [ProductImagesService, JwtGuard, RolesGuard],
  exports: [ProductImagesService],
})
export class ProductImagesModule {}
