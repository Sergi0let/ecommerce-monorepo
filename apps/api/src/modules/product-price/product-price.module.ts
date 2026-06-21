import { Module } from '@nestjs/common';
import { ProductPriceController } from './product-price.controller';
import { ProductPriceService } from './product-price.service';

@Module({
  controllers: [ProductPriceController],
  providers: [ProductPriceService],
  exports: [ProductPriceService],
})
export class ProductPriceModule {}
