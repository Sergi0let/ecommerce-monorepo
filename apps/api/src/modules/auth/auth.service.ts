import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  LoginLocalType,
  RegisterLocalType,
  SocialAuthType,
  UserType,
} from '@repo/contracts';
import { createHash, randomUUID } from 'node:crypto';
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
