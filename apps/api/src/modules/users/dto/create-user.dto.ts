import { RegisterLocalSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateUserDto extends createZodDto(RegisterLocalSchema) {}
