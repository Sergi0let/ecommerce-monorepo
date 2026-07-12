import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '../../common/primitives.js';

// User roles
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
}

export const UserRoleEnum = z.enum([
  UserRole.CUSTOMER,
  UserRole.ADMIN,
  UserRole.MANAGER,
]);

// User provider types
export enum UserProvider {
  LOCAL = 'LOCAL',
  GOOGLE = 'GOOGLE',
  FACEBOOK = 'FACEBOOK',
}

export const UserProviderEnum = z.enum([
  UserProvider.LOCAL,
  UserProvider.GOOGLE,
  UserProvider.FACEBOOK,
]);

// Main User schema (response/display)
export const UserSchema = z.object({
  id: UuidSchema,
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: UserRoleEnum,
  provider: UserProviderEnum,
  isEmailVerified: z.boolean(),
  isActive: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
