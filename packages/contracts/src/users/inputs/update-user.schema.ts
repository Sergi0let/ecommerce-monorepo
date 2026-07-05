import { z } from 'zod';
import { UserInputBaseSchema } from './create-user.schema.js';

// Update user profile (email, name, avatar)
export const UpdateUserSchema = UserInputBaseSchema.partial();

// Change password schema
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
});

// Verify email schema
export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

// Request password reset schema
export const RequestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// Reset password schema
export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
});
