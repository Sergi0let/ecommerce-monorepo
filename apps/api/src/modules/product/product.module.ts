import { Module } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductImageStorageModule } from '../product-images/product-image-storage.module';

@Module({
  imports: [ProductImageStorageModule],
  controllers: [ProductController],
  providers: [ProductService, JwtGuard, RolesGuard],
  exports: [ProductService],
})
export class ProductModule {}
