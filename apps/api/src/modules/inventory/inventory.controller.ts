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
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { InventoryDto } from './dto/inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a single inventory' })
  @ApiResponse({ status: 201, type: InventoryDto })
  @ApiResponse({ status: 404, description: 'Variant or warehouse not found' })
  @ApiResponse({ status: 409, description: 'Inventory already exists' })
  create(@Body() body: CreateInventoryDto) {
    return this.inventoryService.create(body);
  }

  @Put('id/:id')
  @ApiOperation({ summary: 'Update inventory by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: InventoryDto })
  @ApiResponse({ status: 400, description: 'Invalid inventory quantities' })
  @ApiResponse({ status: 404, description: 'Inventory by ID not found' })
  updateById(@Param('id') id: string, @Body() data: UpdateInventoryDto) {
    return this.inventoryService.updateById(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete inventory' })
  @ApiResponse({ status: 204, description: 'Inventory deleted' })
  @ApiResponse({ status: 404, description: 'Inventory not found' })
  delete(@Param('id') id: string) {
    return this.inventoryService.delete(id);
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Get inventory by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: InventoryDto })
  @ApiResponse({ status: 404, description: 'Inventory by ID not found' })
  getById(@Param('id') id: string) {
    return this.inventoryService.getById(id);
  }

  @Get('by-product/:id')
  @ApiOperation({ summary: 'Get all inventory by product slug' })
  @ApiResponse({ status: 200, type: InventoryDto })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getByProductId(@Param('id') id: string) {
    return this.inventoryService.getByProductId(id);
  }
}
