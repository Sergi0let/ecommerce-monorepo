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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@repo/contracts';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
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
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiOperation({ summary: 'Create a product with its initial variant' })
  @ApiResponse({ status: 201, type: ProductDto })
  @ApiResponse({
    status: 409,
    description: 'Product or variant slug, or variant SKU already exists',
  })
  create(@Body() data: CreateProductDto) {
    return this.productService.create(data);
  }

  @Put('id/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiOperation({ summary: 'Update product by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductDto })
  @ApiResponse({ status: 404, description: 'Product not found' })
  updateById(@Param('id') id: string, @Body() data: UpdateProductDto) {
    return this.productService.updateById(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
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
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductDto })
  @ApiResponse({ status: 404, description: 'Product by ID not found' })
  getById(@Param('id') id: string) {
    return this.productService.getById(id);
  }

  @Get('by-variant/:variantSlug')
  @ApiOperation({ summary: 'Get product by globally unique variant slug' })
  @ApiParam({ name: 'variantSlug', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductDto })
  @ApiResponse({ status: 404, description: 'Product variant not found' })
  getByVariantSlug(@Param('variantSlug') variantSlug: string) {
    return this.productService.getByVariantSlug(variantSlug);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get Product by SLUG' })
  @ApiResponse({ status: 200, type: ProductDto })
  @ApiResponse({ status: 404, description: 'Product by SLUG not found' })
  getBySlug(@Param('slug') slug: string) {
    return this.productService.getBySlug(slug);
  }
}
