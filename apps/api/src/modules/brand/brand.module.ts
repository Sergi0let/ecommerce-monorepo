import { Module } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';

@Module({
  controllers: [BrandController],
  providers: [BrandService, JwtGuard, RolesGuard],
  exports: [BrandService],
})
export class BrandModule {}
