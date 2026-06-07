import { z } from 'zod';

export function parseSchema<T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.infer<T> {
  return schema.parse(data);
}

export function safeParseSchema<T extends z.ZodType>(schema: T, data: unknown) {
  return schema.safeParse(data);
}
