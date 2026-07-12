import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ChangePasswordType,
  RegisterLocalType,
  RequestPasswordResetType,
  SocialAuthType,
  UpdateUserType,
  UserType,
} from '@repo/contracts';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a new user with local email + password
   */
  async registerLocal(data: RegisterLocalType): Promise<UserType> {
    this.logger.log(`Registering user with email ${data.email}`);

    // Check if user already exists
    const existingUser = await this.prisma.client.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await this.prisma.client.user.create({
      data: {
        email: data.email,
        passwordHash: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl,
        role: 'CUSTOMER',
        provider: 'LOCAL',
        isEmailVerified: false,
        isActive: true,
      },
    });

    return this.toUserType(user);
  }

  /**
   * Find user by email (for login)
   */
  async findByEmail(email: string) {
    return this.prisma.client.user.findUnique({
      where: { email },
      include: { socialAccounts: true },
    });
  }

  /**
   * Find user by ID
   */
  async findById(id: number): Promise<UserType> {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
      include: { socialAccounts: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserType(user);
  }

  /**
   * Update user profile (name, avatar)
   */
  async updateProfile(id: number, data: UpdateUserType): Promise<UserType> {
    this.logger.log(`Updating user profile ${id}`);

    // Ensure user exists
    await this.findById(id);

    // If email is being updated, check uniqueness
    if (data.email) {
      const existingUser = await this.prisma.client.user.findUnique({
        where: { email: data.email },
      });
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    const user = await this.prisma.client.user.update({
      where: { id },
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl,
      },
    });

    return this.toUserType(user);
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(id: number, data: ChangePasswordType): Promise<void> {
    this.logger.log(`Changing password for user ${id}`);

    const user = await this.prisma.client.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = user.passwordHash
      ? await bcrypt.compare(data.currentPassword, user.passwordHash)
      : false;

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.newPassword, 10);

    await this.prisma.client.user.update({
      where: { id },
      data: { passwordHash: hashedPassword },
    });
  }

  /**
   * Verify email
   */
  async verifyEmail(id: number): Promise<void> {
    this.logger.log(`Verifying email for user ${id}`);

    await this.prisma.client.user.update({
      where: { id },
      data: { isEmailVerified: true },
    });
  }

  /**
   * Request password reset token (simplified - in production use email)
   */
  async requestPasswordReset(
    data: RequestPasswordResetType,
  ): Promise<{ message: string }> {
    this.logger.log(`Password reset requested for email ${data.email}`);

    const user = await this.prisma.client.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // In production: send email with reset token
    // For now: just return a message
    return { message: 'Password reset email sent (if email exists)' };
  }

  /**
   * Reset password with token
   */
  async resetPassword(): Promise<void> {
    this.logger.log('Resetting password with token');

    // In production: validate token and find user by token
    // For MVP: simplified - would need proper token handling
    throw new BadRequestException('Password reset not yet implemented');
  }

  /**
   * Find or create user from social auth (Google/Facebook)
   */
  async findOrCreateFromSocialAuth(data: SocialAuthType): Promise<UserType> {
    this.logger.log(`Social auth login: ${data.provider} (${data.providerId})`);

    // Check if social account exists
    const existingSocial = await this.prisma.client.socialAccount.findFirst({
      where: {
        provider: data.provider,
        providerId: data.providerId,
      },
      include: { user: { include: { socialAccounts: true } } },
    });

    if (existingSocial) {
      return this.toUserType(existingSocial.user);
    }

    // Check if user exists by email
    let user = await this.prisma.client.user.findUnique({
      where: { email: data.email },
      include: { socialAccounts: true },
    });

    // Create new user if doesn't exist
    if (!user) {
      user = await this.prisma.client.user.create({
        data: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          avatarUrl: data.avatarUrl,
          role: 'CUSTOMER',
          provider: data.provider,
          isEmailVerified: true, // Social accounts are pre-verified
          isActive: true,
          socialAccounts: {
            create: {
              provider: data.provider,
              providerId: data.providerId,
            },
          },
        },
        include: { socialAccounts: true },
      });
    } else {
      // Link social account to existing user
      await this.prisma.client.socialAccount.create({
        data: {
          userId: user.id,
          provider: data.provider,
          providerId: data.providerId,
        },
      });

      // Reload user with updated social accounts
      user = await this.prisma.client.user.findUnique({
        where: { id: user.id },
        include: { socialAccounts: true },
      })!;
    }

    return this.toUserType(user);
  }

  /**
   * Validate password for login
   */
  async validatePassword(
    email: string,
    password: string,
  ): Promise<UserType | null> {
    const user = await this.findByEmail(email);

    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return null;
    }

    return this.toUserType(user);
  }

  /**
   * Helper: convert database user to UserType (exclude password)
   */
  private toUserType(user: any): UserType {
    return {
      id: user.id.toString(),
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      avatarUrl: user.avatarUrl || undefined,
      role: user.role as any,
      provider: user.provider as any,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt || undefined,
    };
  }
}
