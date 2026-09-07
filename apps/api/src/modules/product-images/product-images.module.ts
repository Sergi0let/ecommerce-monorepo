import { Module } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProductImagesController } from './product-images.controller';
import { ProductImagesService } from './product-images.service';

@Module({
  controllers: [ProductImagesController],
  providers: [ProductImagesService, JwtGuard, RolesGuard],
  exports: [ProductImagesService],
})
export class ProductImagesModule {}
