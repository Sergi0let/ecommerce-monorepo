import { ChangePasswordSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
