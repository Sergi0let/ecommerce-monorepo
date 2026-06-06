import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandResponseDto } from './dto/brand-response.dto';
import { PickType } from '@nestjs/mapped-types';

@ApiTags('brands')
@Controller('brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @ApiOperation({ summary: 'Get all brands and their products' })
  @ApiResponse({ status: 200, type: [BrandResponseDto] })
  async findAll() {
    return this.brandService.findAll();
  }

  @Get('list')
  @ApiOperation({ summary: 'Get all brands names' })
  @ApiResponse({
    status: 200,
    type: [
      PickType(BrandResponseDto, ['id', 'name', 'slug', 'logo', 'isActive']),
    ],
  })
  async findAllNames() {
    return this.brandService.findAllNames();
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get brand by ID' })
  @ApiResponse({ status: 200, type: BrandResponseDto })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async findById(@Param('id') id: string) {
    return this.brandService.findById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get brand by slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.brandService.findBySlug(slug);
  }

  @Post()
  @ApiOperation({ summary: 'Create new brand' })
  @ApiResponse({ status: 201, type: BrandResponseDto })
  async create(@Body() data: CreateBrandDto) {
    return this.brandService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update brand' })
  async update(@Param('id') id: string, @Body() data: UpdateBrandDto) {
    return this.brandService.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete brand' })
  async delete(@Param('id') id: string) {
    return this.brandService.delete(id);
  }

  @Get(':id/products')
  @ApiOperation({ summary: 'Get all products of a brand' })
  async getProducts(@Param('id') id: string) {
    return this.brandService.getProducts(id);
  }
}
