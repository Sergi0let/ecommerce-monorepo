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
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandResponseDto, BrandWithCountsDto } from './dto/brand-response.dto';
import { BrandSummaryDto } from './dto/brand-summary.dto';
import { BrandProductsPageDto } from './dto/brand-products-page.dto';

@ApiTags('brands')
@Controller('brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @ApiOperation({ summary: 'Get all brands with product/category counts' })
  @ApiResponse({ status: 200, type: [BrandWithCountsDto] })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  findAll(
    @Query('isActive', new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
  ) {
    return this.brandService.findAll(isActive);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get active brands for selectors' })
  @ApiResponse({ status: 200, type: [BrandSummaryDto] })
  findAllNames() {
    return this.brandService.findAllNames();
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get brand by slug with active products' })
  @ApiResponse({ status: 200, type: BrandResponseDto })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  findBySlug(@Param('slug') slug: string) {
    return this.brandService.findBySlug(slug);
  }

  @Get(':id/products')
  @ApiOperation({ summary: 'Get active products of a brand' })
  @ApiResponse({ status: 200, type: BrandProductsPageDto })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  findByIdProducts(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.brandService.getProducts(id, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get brand by ID' })
  @ApiResponse({ status: 200, type: BrandResponseDto })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  findById(@Param('id') id: string) {
    return this.brandService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new brand' })
  @ApiResponse({ status: 201, type: BrandResponseDto })
  create(@Body() data: CreateBrandDto) {
    return this.brandService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update brand' })
  @ApiResponse({ status: 200, type: BrandResponseDto })
  update(@Param('id') id: string, @Body() data: UpdateBrandDto) {
    return this.brandService.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete brand' })
  @ApiResponse({ status: 204, description: 'Brand deleted' })
  @ApiResponse({
    status: 409,
    description: 'Brand has associated products or categories',
  })
  delete(@Param('id') id: string) {
    return this.brandService.delete(id);
  }
}
