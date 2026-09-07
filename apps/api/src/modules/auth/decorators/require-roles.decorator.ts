import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiResponse } from '@nestjs/swagger';
import type { UserRole } from '@repo/contracts';
import { JwtGuard } from '../guards/jwt.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

export const RequireRoles = (...roles: [UserRole, ...UserRole[]]) =>
  applyDecorators(
    UseGuards(JwtGuard, RolesGuard),
    Roles(...roles),
    ApiBearerAuth(),
    ApiCookieAuth(),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
