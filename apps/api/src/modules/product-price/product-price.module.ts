import { Module } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProductPriceController } from './product-price.controller';
import { ProductPriceService } from './product-price.service';

@Module({
  controllers: [ProductPriceController],
  providers: [ProductPriceService, JwtGuard, RolesGuard],
  exports: [ProductPriceService],
})
export class ProductPriceModule {}
