import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateProductPriceDto } from './dto/create-product-price.dto';
import { ProductPriceDto } from './dto/product-price.dto';
import { UpdateProductPriceDto } from './dto/update-product-price.dto';
import { ProductPriceService } from './product-price.service';

@ApiTags('Product price')
@Controller('product-prices')
export class ProductPriceController {
  constructor(private readonly productPriceService: ProductPriceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new price for a product variant' })
  @ApiResponse({ status: 201, type: ProductPriceDto })
  create(@Body() data: CreateProductPriceDto) {
    return this.productPriceService.create(data);
  }

  @Put('id/:id')
  @ApiOperation({ summary: 'Update product price by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductPriceDto })
  @ApiResponse({ status: 404, description: 'Product price not found' })
  updateById(@Param('id') id: string, @Body() data: UpdateProductPriceDto) {
    return this.productPriceService.updateById(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product price' })
  @ApiResponse({ status: 204, description: 'Product price deleted' })
  delete(@Param('id') id: string) {
    return this.productPriceService.delete(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all product prices' })
  @ApiResponse({ status: 200, type: [ProductPriceDto] })
  getAll() {
    return this.productPriceService.getAll();
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Get product price by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductPriceDto })
  @ApiResponse({ status: 404, description: 'Product price by ID not found' })
  getById(@Param('id') id: string) {
    return this.productPriceService.getById(id);
  }
}
