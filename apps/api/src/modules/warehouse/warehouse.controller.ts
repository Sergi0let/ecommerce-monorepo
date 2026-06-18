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
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseQueryDto } from './dto/warehouse-query.dto';
import { WarehouseDto } from './dto/warehouse.dto';
import { WarehouseService } from './warehouse.service';

@ApiTags('Warehouse')
@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new warehouse' })
  @ApiResponse({ status: 201, type: WarehouseDto })
  create(@Body() data: CreateWarehouseDto) {
    return this.warehouseService.create(data);
  }

  @Put('id/:id')
  @ApiOperation({ summary: 'Update warehouse by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 201, type: WarehouseDto })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  updataById(@Param('id') id: string, @Body() data: UpdateWarehouseDto) {
    return this.warehouseService.updateById(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete warehouse' })
  @ApiResponse({ status: 204, description: 'Warehouse deleted' })
  @ApiResponse({
    status: 409,
    description: 'Warehouse has associated products',
  })
  delete(@Param('id') id: string) {
    return this.warehouseService.delete(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all warehouse' })
  @ApiResponse({ status: 200, type: [WarehouseDto] })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  @ApiQuery({ name: 'sort', enum: ['asc', 'desc'], required: false })
  getAll(@Query() query: WarehouseQueryDto) {
    return this.warehouseService.getAll(query);
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Get warehouse by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: WarehouseDto })
  @ApiResponse({ status: 404, description: 'Warehouse by ID not found' })
  getById(@Param('id') id: string) {
    return this.warehouseService.getById(id);
  }
}
