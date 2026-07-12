import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RefreshTokenPayload } from '../types/refresh-token-payload';

export interface RefreshRequestUser extends RefreshTokenPayload {
  refreshToken: string;
}

const extractRefreshToken = (request: Request): string | null => {
  return request.cookies?.refresh_token ?? null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractRefreshToken]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_REFRESH_SECRET',
        'dev-refresh-secret-change-me',
      ),
      passReqToCallback: true,
    });
  }

  validate(request: Request, payload: RefreshTokenPayload): RefreshRequestUser {
    const refreshToken = extractRefreshToken(request);

    if (
      !refreshToken ||
      payload.type !== 'refresh' ||
      !payload.sessionId ||
      !payload.id
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      ...payload,
      refreshToken,
    };
  }
}
