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
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BrandService } from './brand.service';
import { BrandProductsQueryDto } from './dto/brand-product-query.dto';
import { BrandProductsPageDto } from './dto/brand-products-page.dto';
import { BrandResponseDto } from './dto/brand-response.dto';
import { BrandSummariesPageDto } from './dto/brand-summaries-page.dto';
import { BrandDto } from './dto/brand.dto';
import { BrandsQueryDto } from './dto/brands-query.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@ApiTags('brands')
@Controller('brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new brand' })
  @ApiResponse({ status: 201, type: BrandResponseDto })
  create(@Body() data: CreateBrandDto) {
    return this.brandService.create(data);
  }

  @Put('id/:id')
  @ApiOperation({ summary: 'Update brand by ID' })
  @ApiResponse({ status: 201, type: BrandDto })
  updateById(@Param('id') id: string, @Body() data: UpdateBrandDto) {
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

  @Get()
  @ApiOperation({ summary: 'Get all brands' })
  @ApiResponse({ status: 200, type: [BrandDto] })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  @ApiQuery({ name: 'sort', enum: ['asc', 'desc'], required: false })
  getAll(@Query() query: BrandsQueryDto) {
    return this.brandService.getAll(query);
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Get brand by ID' })
  @ApiResponse({ status: 200, type: BrandDto })
  @ApiResponse({ status: 404, description: 'Brand by ID not found' })
  getById(@Param('id') id: string) {
    return this.brandService.getById(id);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get active brands for selectors' })
  @ApiResponse({ status: 200, type: BrandSummariesPageDto })
  findAllSummaries(@Query() query: BrandProductsQueryDto) {
    return this.brandService.findAllSummaries(query);
  }

  @Get(':slug/products')
  @ApiOperation({ summary: 'Get active products of a brand' })
  @ApiResponse({ status: 200, type: BrandProductsPageDto })
  getProductsBySlug(
    @Param('slug') slug: string,
    @Query() query: BrandProductsQueryDto,
  ) {
    return this.brandService.getProductsBySlug(slug, query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get brand by SLUG' })
  @ApiResponse({ status: 200, type: BrandDto })
  @ApiResponse({ status: 404, description: 'Brand by SLUG not found' })
  getBySlug(@Param('slug') slug: string) {
    return this.brandService.getBySlug(slug);
  }
}
