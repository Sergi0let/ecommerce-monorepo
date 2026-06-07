import { z } from 'zod';

export const UuidSchema = z.uuid();

export const SlugSchema = z.string().min(3);

/** ISO 8601 — OpenAPI/JSON-safe (unlike z.date / z.coerce.date) */
export const TimestampSchema = z.iso.datetime();
