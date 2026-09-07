import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@repo/contracts';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../types/jwt-payload';

const extractAccessToken = (request: Request): string | null => {
  return request.cookies?.access_token ?? null;
};
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractAccessToken,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_ACCESS_SECRET',
        'dev-access-secret-change-me',
      ),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (
      !Number.isSafeInteger(payload?.id) ||
      payload.id <= 0 ||
      payload.id > 2_147_483_647
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException('User is inactive or no longer exists');
    }

    return { id: user.id, email: user.email, role: UserRole[user.role] };
  }
}
