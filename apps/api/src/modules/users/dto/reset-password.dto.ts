import { ResetPasswordSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
