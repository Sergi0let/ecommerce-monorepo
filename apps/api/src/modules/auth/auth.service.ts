import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthResponseType,
  LoginLocalType,
  RegisterLocalType,
  SocialAuthType,
  UserType,
} from '@repo/contracts';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './types/jwt-payload';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(data: RegisterLocalType): Promise<AuthResponseType> {
    this.logger.log(`Registering user ${data.email}`);
    const user = await this.usersService.registerLocal(data);
    return this.buildAuthResponse(user);
  }

  async login(data: LoginLocalType): Promise<AuthResponseType> {
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

    return this.buildAuthResponse(user);
  }

  async socialLogin(data: SocialAuthType): Promise<AuthResponseType> {
    const user = await this.usersService.findOrCreateFromSocialAuth(data);

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: UserType): AuthResponseType {
    const payload = this.toJwtPayload(user);

    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }

  private toJwtPayload(user: UserType): JwtPayload {
    return {
      id: Number(user.id),
      email: user.email,
      role: user.role,
    };
  }
}
