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
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { IngredientDto } from './dto/ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { IngredientService } from './ingredient.service';

@ApiTags('Ingredients')
@Controller('ingredients')
export class IngredientController {
  constructor(private readonly ingredientService: IngredientService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new ingredient' })
  @ApiResponse({ status: 201, type: IngredientDto })
  @ApiResponse({ status: 409, description: 'Ingredient slug already exists' })
  create(@Body() body: CreateIngredientDto) {
    return this.ingredientService.create(body);
  }

  @Put('id/:id')
  @ApiOperation({ summary: 'Update ingredient by id' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: IngredientDto })
  @ApiResponse({ status: 404, description: 'Ingredient by ID not found' })
  @ApiResponse({ status: 409, description: 'Ingredient slug already exists' })
  updateById(@Param('id') id: string, @Body() data: UpdateIngredientDto) {
    return this.ingredientService.updateById(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete ingredient' })
  @ApiResponse({ status: 204, description: 'Ingredient deleted' })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  delete(@Param('id') id: string) {
    return this.ingredientService.delete(id);
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Get ingredient by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: IngredientDto })
  @ApiResponse({ status: 404, description: 'Ingredient by ID not found' })
  getById(@Param('id') id: string) {
    return this.ingredientService.getById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get ingredients' })
  @ApiResponse({ status: 200, type: [IngredientDto] })
  getAll() {
    return this.ingredientService.getAll();
  }
}
