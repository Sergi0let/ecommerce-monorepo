import { Module } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProductVariantController } from './product-variant.controller';
import { ProductVariantService } from './product-variant.service';

@Module({
  controllers: [ProductVariantController],
  providers: [ProductVariantService, JwtGuard, RolesGuard],
  exports: [ProductVariantService],
})
export class ProductVariantModule {}
