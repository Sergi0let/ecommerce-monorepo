import { PaginationQuerySchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class PaginationDto extends createZodDto(PaginationQuerySchema) {}
