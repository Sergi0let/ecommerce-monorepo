import { CategoriesQuerySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CategoriesQueryDto extends createZodDto(CategoriesQuerySchema) {}
