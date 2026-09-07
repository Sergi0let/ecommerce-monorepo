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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@repo/contracts';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { ProductVariantDto } from './dto/product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { ProductVariantService } from './product-variant.service';

@ApiTags('Product variant')
@Controller('product-variants')
export class ProductVariantController {
  constructor(private readonly productVariantService: ProductVariantService) {}
  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a single product variant' })
  @ApiResponse({ status: 201, type: ProductVariantDto })
  create(@Body() body: CreateProductVariantDto) {
    return this.productVariantService.create(body);
  }

  @Put('id/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product variant by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductVariantDto })
  @ApiResponse({ status: 404, description: 'Product variant by ID not found' })
  updateById(@Param('id') id: string, @Body() data: UpdateProductVariantDto) {
    return this.productVariantService.updateById(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product variant' })
  @ApiResponse({ status: 204, description: 'Delete product variant by id' })
  @ApiResponse({ status: 409, description: 'Cannot delete the last variant' })
  delete(@Param('id') id: string) {
    return this.productVariantService.delete(id);
  }

  @Get('id/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get product variant by id' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductVariantDto })
  @ApiResponse({ status: 404, description: 'Product variant by ID not found' })
  getById(@Param('id') id: string) {
    return this.productVariantService.getById(id);
  }

  @Get('by-product/:slug')
  @ApiOperation({ summary: 'Get all product variant by product SLUG' })
  @ApiResponse({ status: 200, type: [ProductVariantDto] })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getByProductSlug(@Param('slug') slug: string) {
    return this.productVariantService.getByProductSlug(slug);
  }
}
