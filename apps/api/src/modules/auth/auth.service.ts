import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  LoginLocalType,
  RegisterLocalType,
  RequestPasswordResetType,
  ResetPasswordType,
  SocialAuthType,
  UserType,
} from '@repo/contracts';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RefreshRequestUser } from './strategies/jwt-refresh.strategy';
import { JwtPayload } from './types/jwt-payload';
import { RefreshTokenPayload } from './types/refresh-token-payload';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

interface AuthResult extends AuthTokens {
  user: UserType;
}

const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL = 15 * 60 * 1000;
const EMAIL_VERIFICATION_TOKEN_TTL = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async register(data: RegisterLocalType): Promise<AuthResult> {
    this.logger.log(`Registering user ${data.email}`);
    const user = await this.usersService.registerLocal(data);
    return this.buildAuthResult(user);
  }

  async login(data: LoginLocalType): Promise<AuthResult> {
    this.logger.log(`Login attempt for ${data.email}`);

    const user = await this.usersService.validatePassword(
      data.email,
      data.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    return this.buildAuthResult(user);
  }

  async socialLogin(data: SocialAuthType): Promise<AuthResult> {
    const user = await this.usersService.findOrCreateFromSocialAuth(data);

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    return this.buildAuthResult(user);
  }

  async refresh(payload: RefreshRequestUser): Promise<{
    user: UserType;
    accessToken: string;
    refreshToken: string;
    refreshExpiresAt: Date;
  }> {
    const session = await this.prismaService.client.refreshSession.findUnique({
      where: { id: payload.sessionId },
    });

    if (
      !session ||
      session.userId !== payload.id ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.tokenHash !== this.hashToken(payload.refreshToken)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.id);

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const revoked = await this.prismaService.client.refreshSession.updateMany({
      where: {
        id: session.id,
        userId: payload.id,
        tokenHash: this.hashToken(payload.refreshToken),
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (revoked.count !== 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.createTokenPair(user);

    return {
      user,
      ...tokens,
    };
  }

  async tryRevokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>(
            'JWT_REFRESH_SECRET',
            'dev-refresh-secret-change-me',
          ),
          ignoreExpiration: true,
        },
      );

      if (payload.type !== 'refresh' || !payload.sessionId || !payload.id) {
        return;
      }

      const tokenHash = this.hashToken(refreshToken);

      await this.prismaService.client.refreshSession.updateMany({
        where: {
          id: payload.sessionId,
          userId: payload.id,
          tokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } catch {
      // Logout повинен залишатися успішним навіть для:
      // - пошкодженого токена;
      // - токена з неправильним підписом;
      // - уже видаленої сесії.
    }
  }

  async sendEmailVerification(userId: number): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (user.isEmailVerified) {
      return;
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL);

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.emailVerificationToken.deleteMany({
        where: { userId, usedAt: null },
      });
      await tx.emailVerificationToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });
    });

    return;
  }

  async verifyEmailAddress(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const emailVerificationToken =
      await this.prismaService.client.emailVerificationToken.findFirst({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
          userId: true,
          usedAt: true,
          expiresAt: true,
        },
      });

    if (!emailVerificationToken) {
      throw new BadRequestException('Invalid or expired token');
    }

    const user = await this.usersService.findById(
      emailVerificationToken.userId,
    );

    if (
      emailVerificationToken.usedAt ||
      emailVerificationToken.expiresAt <= new Date() ||
      user.isEmailVerified
    ) {
      throw new BadRequestException('Invalid or expired token');
    }

    await this.prismaService.client.$transaction(async (tx) => {
      const consumedToken = await tx.emailVerificationToken.updateMany({
        where: {
          id: emailVerificationToken.id,
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          usedAt: new Date(),
        },
      });

      if (consumedToken.count === 0) {
        throw new BadRequestException('Invalid or expired token');
      }

      await tx.user.update({
        where: { id: emailVerificationToken.userId },
        data: { isEmailVerified: true },
      });
    });

    return;
  }

  async requestPasswordReset(
    data: RequestPasswordResetType,
  ): Promise<{ message: string }> {
    const errorMessage = 'If the account exists, a reset email has been sent';
    this.logger.log(`Password reset requested for email ${data.email}`);

    const user = await this.usersService.findByEmail(data.email);

    if (!user) {
      return {
        message: errorMessage,
      };
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL);

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        `Password reset URL: http://localhost:3010/reset-password?token=${rawToken}`,
      );
    }
    return {
      message: errorMessage,
    };
  }

  async resetPassword(dto: ResetPasswordType): Promise<void> {
    this.logger.log('Resetting password with token');

    const { token, newPassword } = dto;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const resetToken =
      await this.prismaService.client.passwordResetToken.findFirst({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.prismaService.client.user.findUniqueOrThrow({
      where: { id: resetToken.userId },
      select: { passwordHash: true },
    });

    const isSamePassword =
      user.passwordHash &&
      (await bcrypt.compare(newPassword, user.passwordHash));

    if (isSamePassword) {
      throw new BadRequestException(
        'New password cannot be the same as the old password',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prismaService.client.$transaction(async (tx) => {
      const resetAt = new Date();

      const consumedToken = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: {
            gt: resetAt,
          },
        },
        data: {
          usedAt: resetAt,
        },
      });

      if (consumedToken.count !== 1) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });

      await tx.refreshSession.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    });

    return;
  }

  private async buildAuthResult(user: UserType): Promise<AuthResult> {
    const tokens = await this.createTokenPair(user);
    return {
      user,
      ...tokens,
    };
  }

  private toJwtPayload(user: UserType): JwtPayload {
    return {
      id: Number(user.id),
      email: user.email,
      role: user.role,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async createTokenPair(user: UserType): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL);

    const accessToken = await this.jwtService.signAsync(
      this.toJwtPayload(user),
      {
        secret: this.configService.get<string>(
          'JWT_ACCESS_SECRET',
          'dev-access-secret-change-me',
        ),
        expiresIn: '15m',
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        id: Number(user.id),
        sessionId,
        type: 'refresh',
      } satisfies RefreshTokenPayload,
      {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'dev-refresh-secret-change-me',
        ),
        expiresIn: '30d',
      },
    );

    await this.prismaService.client.refreshSession.create({
      data: {
        id: sessionId,
        userId: Number(user.id),
        tokenHash: this.hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt,
    };
  }
}
