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
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductDto } from './dto/product.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { ProductsResponseDto } from './dto/products-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './product.service';

@ApiTags('Product')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a single product' })
  @ApiResponse({ status: 201, type: ProductDto })
  create(@Body() data: CreateProductDto) {
    return this.productService.create(data);
  }

  @Put('id/:id')
  @ApiOperation({ summary: 'Update product by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 201, type: ProductDto })
  @ApiResponse({ status: 404, description: 'Product not found' })
  updateById(@Param('id') id: string, @Body() data: UpdateProductDto) {
    return this.productService.updateById(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product' })
  @ApiResponse({ status: 204, description: 'Delete product by id' })
  delete(@Param('id') id: string) {
    return this.productService.delete(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, type: ProductsResponseDto })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'sort', enum: ['asc', 'desc'], required: false })
  getAll(@Query() query: ProductsQueryDto) {
    return this.productService.getAll(query);
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductDto })
  @ApiResponse({ status: 404, description: 'Product by ID not found' })
  getById(@Param('id') id: string) {
    return this.productService.getById(id);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get Product by SLUG' })
  @ApiResponse({ status: 200, type: ProductDto })
  @ApiResponse({ status: 404, description: 'Product by SLUG not found' })
  getBySlug(@Param('slug') slug: string) {
    return this.productService.getBySlug(slug);
  }
}
