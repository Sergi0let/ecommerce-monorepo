import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { BrandModule } from './modules/brand/brand.module';
import { CategoryModule } from './modules/category/category.module';
import { IngredientModule } from './modules/ingredient/ingredient.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ProductImagesModule } from './modules/product-images/product-images.module';
import { ProductPriceModule } from './modules/product-price/product-price.module';
import { ProductVariantModule } from './modules/product-variant/product-variant.module';
import { ProductModule } from './modules/product/product.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UsersModule } from './modules/users/users.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    LoggerModule.forRoot({
      pinoHttp: {
        serializers: {
          req: (request) => ({
            method: request.method,
            url: request.url?.split('?', 1)[0],
            remoteAddress: request.remoteAddress,
          }),
          res: (response) => ({
            statusCode: response.statusCode,
          }),
        },
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
          },
        },
      },
    }),
    WarehouseModule,
    BrandModule,
    CategoryModule,
    ProductModule,
    ProductVariantModule,
    ProductPriceModule,
    ProductImagesModule,
    InventoryModule,
    IngredientModule,
    AuthModule,
    UsersModule,
    ReviewsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
