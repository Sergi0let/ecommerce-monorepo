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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CategoryService } from './category.service';
import { CategoryProductsPageDto } from './dto/category-products-page.dto';
import { CategoryDto } from './dto/category.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, type: [CategoryDto] })
  findAll() {
    return this.categoryService.findAll();
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiResponse({ status: 200, type: CategoryDto })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findBySlug(@Param('slug') slug: string) {
    return this.categoryService.findBySlug(slug);
  }

  @Get('slug/:slug/products')
  @ApiOperation({ summary: 'Get active products by category slug' })
  @ApiResponse({ status: 200, type: CategoryProductsPageDto })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findProductsBySlug(
    @Param('slug') slug: string,
    @Query() query: PaginationDto,
  ) {
    return this.categoryService.getProductsBySlug(
      slug,
      query.page,
      query.limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, type: CategoryDto })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findById(@Param('id') id: string) {
    return this.categoryService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, type: CategoryDto })
  @ApiResponse({
    status: 404,
    description: 'Brand or parent category not found',
  })
  create(@Body() data: CreateCategoryDto) {
    return this.categoryService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiResponse({ status: 200, type: CategoryDto })
  @ApiResponse({ status: 404, description: 'Category not found' })
  update(@Param('id') id: string, @Body() data: UpdateCategoryDto) {
    return this.categoryService.update(id, data);
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
}
