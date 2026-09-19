import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@repo/contracts';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { CreateProductImagesDto } from './dto/create-product-images.dto';
import { ProductImagesDto } from './dto/product-images.dto';
import { UpdateProductImagesDto } from './dto/update-product-images.dto';
import { ProductImagesService } from './product-images.service';

@ApiTags('Product Images')
@Controller()
export class ProductImagesController {
  constructor(private readonly productImagesService: ProductImagesService) {}

  @Post('products/:productId/images')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Product image upload placeholder',
    description:
      'Validates JSON metadata and ownership, then returns 501. Multipart file upload is not implemented yet.',
  })
  @ApiParam({ name: 'productId', type: String, format: 'uuid', required: true })
  @ApiResponse({ status: 400, description: 'Invalid product ID or metadata' })
  @ApiResponse({ status: 404, description: 'Product or variant not found' })
  @ApiResponse({ status: 501, description: 'Image upload is not implemented' })
  create(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() data: CreateProductImagesDto,
  ) {
    return this.productImagesService.create(productId, data);
  }

  @Put('product-images/id/:id')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update product image metadata by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductImagesDto })
  @ApiResponse({ status: 400, description: 'Invalid image metadata' })
  @ApiResponse({ status: 404, description: 'Product image not found' })
  updateById(@Param('id') id: string, @Body() data: UpdateProductImagesDto) {
    return this.productImagesService.updateById(id, data);
  }

  @Delete('product-images/:id')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product image' })
  @ApiResponse({ status: 204, description: 'Product image deleted' })
  delete(@Param('id') id: string) {
    return this.productImagesService.delete(id);
  }

  @Get('product-images')
  @ApiOperation({ summary: 'Get all product images' })
  @ApiResponse({ status: 200, type: [ProductImagesDto] })
  getAll() {
    return this.productImagesService.getAll();
  }

  @Get('product-images/id/:id')
  @ApiOperation({ summary: 'Get product image by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductImagesDto })
  @ApiResponse({ status: 404, description: 'Product image by ID not found' })
  getById(@Param('id') id: string) {
    return this.productImagesService.getById(id);
  }
}
