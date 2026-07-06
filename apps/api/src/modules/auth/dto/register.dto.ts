import { RegisterLocalSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(RegisterLocalSchema) {}
