import { RequestPasswordResetSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class RequestPasswordResetDto extends createZodDto(
  RequestPasswordResetSchema,
) {}
