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
import { CreateProductImagesDto } from './dto/create-product-images.dto';
import { ProductImagesDto } from './dto/product-images.dto';
import { UpdateProductImagesDto } from './dto/update-product-images.dto';
import { ProductImagesService } from './product-images.service';

@ApiTags('Product Images')
@Controller('product-images')
export class ProductImagesController {
  constructor(private readonly productImagesService: ProductImagesService) {}

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new image for a product or product variant',
  })
  @ApiResponse({ status: 201, type: ProductImagesDto })
  @ApiResponse({ status: 404, description: 'Product or variant not found' })
  create(@Body() data: CreateProductImagesDto) {
    return this.productImagesService.create(data);
  }

  @Put('id/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product image by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductImagesDto })
  @ApiResponse({ status: 404, description: 'Product image not found' })
  updateById(@Param('id') id: string, @Body() data: UpdateProductImagesDto) {
    return this.productImagesService.updateById(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product image' })
  @ApiResponse({ status: 204, description: 'Product image deleted' })
  delete(@Param('id') id: string) {
    return this.productImagesService.delete(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all product images' })
  @ApiResponse({ status: 200, type: [ProductImagesDto] })
  getAll() {
    return this.productImagesService.getAll();
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Get product image by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductImagesDto })
  @ApiResponse({ status: 404, description: 'Product image by ID not found' })
  getById(@Param('id') id: string) {
    return this.productImagesService.getById(id);
  }
}
