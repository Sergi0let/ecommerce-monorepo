import { SocialAuthSchema } from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

export class SocialAuthDto extends createZodDto(SocialAuthSchema) {}
