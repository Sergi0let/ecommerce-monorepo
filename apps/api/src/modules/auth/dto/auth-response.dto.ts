import { AuthResponseSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class AuthResponseDto extends createZodDto(AuthResponseSchema) {}
