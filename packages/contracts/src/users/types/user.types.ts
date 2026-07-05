import { z } from 'zod';
import {
  // ChangePasswordSchema,
  CreateUserSchema,
  LoginLocalSchema,
  RegisterLocalSchema,
  // RequestPasswordResetSchema,
  // ResetPasswordSchema,
  SocialAuthSchema,
} from '../inputs/create-user.schema.js';
import {
  ChangePasswordSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
  UpdateUserSchema,
  VerifyEmailSchema,
} from '../inputs/update-user.schema.js';
import {
  UserProvider,
  UserProviderEnum,
  UserRole,
  UserRoleEnum,
  UserSchema,
} from '../schemas/user.schema.js';

// User types
export type UserType = z.infer<typeof UserSchema>;
export type UserRoleType = z.infer<typeof UserRoleEnum>;
export type UserProviderType = z.infer<typeof UserProviderEnum>;

// Register / Create types
export type CreateUserType = z.infer<typeof CreateUserSchema>;
export type RegisterLocalType = z.infer<typeof RegisterLocalSchema>;
export type RegisterLocalInputType = z.input<typeof RegisterLocalSchema>;

// Login types
export type LoginLocalType = z.infer<typeof LoginLocalSchema>;
export type LoginLocalInputType = z.input<typeof LoginLocalSchema>;

// Social auth types
export type SocialAuthType = z.infer<typeof SocialAuthSchema>;
export type SocialAuthInputType = z.input<typeof SocialAuthSchema>;

// Update types
export type UpdateUserType = z.infer<typeof UpdateUserSchema>;
export type UpdateUserInputType = z.input<typeof UpdateUserSchema>;

// Password reset types
export type ChangePasswordType = z.infer<typeof ChangePasswordSchema>;
export type RequestPasswordResetType = z.infer<
  typeof RequestPasswordResetSchema
>;
export type ResetPasswordType = z.infer<typeof ResetPasswordSchema>;

// Email verification types
export type VerifyEmailType = z.infer<typeof VerifyEmailSchema>;

// Export enums
export { UserProvider, UserRole };
