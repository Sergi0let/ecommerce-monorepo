import { z } from 'zod';
import { UserProviderEnum } from '../schemas/user.schema.js';

// Base user input schema with validation
export const UserInputBaseSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1).nullable().optional(),
  lastName: z.string().min(1).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

// Local register schema (email + password)
export const RegisterLocalSchema = UserInputBaseSchema.extend({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
});

// Local login schema
export const LoginLocalSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Social auth callback schema (Google/Facebook)
export const SocialAuthSchema = z.object({
  email: z.string().email(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  provider: UserProviderEnum,
  providerId: z.string(),
});

// Generic create user schema (for internal use)
export const CreateUserSchema = RegisterLocalSchema;
