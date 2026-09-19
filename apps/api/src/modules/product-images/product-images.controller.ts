import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  ParseFilePipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@repo/contracts';
import { ZodSerializerDto } from 'nestjs-zod';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { UploadProductImageDto } from './dto/upload-product-image.dto';
import { ProductImagesDto } from './dto/product-images.dto';
import { UpdateProductImagesDto } from './dto/update-product-images.dto';
import { ProductImagesService } from './product-images.service';

@ApiTags('Product Images')
@Controller()
export class ProductImagesController {
  constructor(private readonly productImagesService: ProductImagesService) {}

  @Post('products/:productId/images')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @ZodSerializerDto(ProductImagesDto)
  @ApiOperation({
    summary: 'Upload a product image',
    description:
      'Accepts one static JPEG, PNG or WebP. Creates three WebP derivatives in storage and one image record. Omit variantId for the shared gallery.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        alt: { type: 'string' },
        variantId: { type: 'string', format: 'uuid' },
        sortOrder: {
          type: 'string',
          pattern: '^\\d+$',
          default: '0',
          description: 'Integer from 0 to 2147483647',
        },
        isPrimary: {
          type: 'string',
          enum: ['true', 'false'],
          default: 'false',
        },
      },
    },
  })
  @ApiParam({ name: 'productId', type: String, format: 'uuid', required: true })
  @ApiResponse({
    status: 400,
    description: 'Invalid product ID, file, metadata or multipart field limits',
  })
  @ApiResponse({ status: 404, description: 'Product or variant not found' })
  @ApiResponse({ status: 201, type: ProductImagesDto })
  @ApiResponse({
    status: 413,
    description: 'File exceeds its size limit',
  })
  @ApiResponse({
    status: 503,
    description: 'Storage unavailable or image processor busy',
  })
  async create(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() data: UploadProductImageDto,
    @UploadedFile(
      new ParseFilePipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
  ) {
    const image = await this.productImagesService.create(
      productId,
      data,
      file.buffer,
    );
    return { ...image, createdAt: image.createdAt.toISOString() };
  }

  @Put('product-images/id/:id')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update product image metadata by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductImagesDto })
  @ApiResponse({ status: 400, description: 'Invalid image metadata' })
  @ApiResponse({ status: 404, description: 'Product image not found' })
  updateById(@Param('id') id: string, @Body() data: UpdateProductImagesDto) {
    return this.productImagesService.updateById(id, data);
  }

  @Delete('product-images/:id')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product image' })
  @ApiResponse({ status: 204, description: 'Product image deleted' })
  delete(@Param('id') id: string) {
    return this.productImagesService.delete(id);
  }

  @Get('product-images')
  @ApiOperation({ summary: 'Get all product images' })
  @ApiResponse({ status: 200, type: [ProductImagesDto] })
  getAll() {
    return this.productImagesService.getAll();
  }

  @Get('product-images/id/:id')
  @ApiOperation({ summary: 'Get product image by ID' })
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiResponse({ status: 200, type: ProductImagesDto })
  @ApiResponse({ status: 404, description: 'Product image by ID not found' })
  getById(@Param('id') id: string) {
    return this.productImagesService.getById(id);
  }
}
