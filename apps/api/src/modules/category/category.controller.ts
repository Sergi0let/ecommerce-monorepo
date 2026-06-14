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
import { CategoryService } from './category.service';
import { CategoriesQueryDto } from './dto/categories-query.dto';
import { CategoryProductsQueryDto } from './dto/category-products-query.dto';
import { CategoryProductsPageDto } from './dto/category-products-page.dto';
import { CategorySummariesPageDto } from './dto/category-summaries-page.dto';
import { CategoryDto } from './dto/category.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, type: CategoryDto })
  @ApiResponse({
    status: 404,
    description: 'Parent category not found',
  })
  create(@Body() data: CreateCategoryDto) {
    return this.categoryService.create(data);
  }

  @Put('id/:id')
  @ApiOperation({ summary: 'Update a category by ID' })
  @ApiResponse({ status: 201, type: CategoryDto })
  @ApiResponse({ status: 404, description: 'Category not found' })
  updateById(@Param('id') id: string, @Body() data: UpdateCategoryDto) {
    return this.categoryService.updateById(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category' })
  @ApiResponse({ status: 204, description: 'Category deleted' })
  @ApiResponse({
    status: 409,
    description: 'Category has child categories or products',
  })
  delete(@Param('id') id: string) {
    return this.categoryService.delete(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, type: [CategoryDto] })
  @ApiQuery({ name: 'sort', enum: ['asc', 'desc'], required: false })
  getAll(@Query() query: CategoriesQueryDto) {
    return this.categoryService.getAll(query);
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, type: CategoryDto })
  @ApiResponse({ status: 404, description: 'Category by ID not found' })
  getById(@Param('id') id: string) {
    return this.categoryService.getById(id);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get category summaries for selectors' })
  @ApiResponse({ status: 200, type: CategorySummariesPageDto })
  getAllSummaries(@Query() query: CategoryProductsQueryDto) {
    return this.categoryService.getAllSummaries(query);
  }

  @Get(':slug/products')
  @ApiOperation({ summary: 'Get active products by category slug' })
  @ApiResponse({ status: 200, type: CategoryProductsPageDto })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findProductsBySlug(
    @Param('slug') slug: string,
    @Query() query: CategoryProductsQueryDto,
  ) {
    return this.categoryService.getProductsBySlug(slug, query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiResponse({ status: 200, type: CategoryDto })
  @ApiResponse({ status: 404, description: 'Category by SLUG not found' })
  getBySlug(@Param('slug') slug: string) {
    return this.categoryService.getBySlug(slug);
  }
}
