import { VerifyEmailSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class VerifyEmailDto extends createZodDto(VerifyEmailSchema) {}
