import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@repo/contracts';
import type { Request } from 'express';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get all authenticated user profile
   */
  @Get()
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all users profiles' })
  @ApiResponse({ status: 200, description: 'All users profile' })
  async getAll() {
    return this.usersService.findAll();
  }

  /**
   * Get current authenticated user profile
   */
  @Get('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Req() req: Request) {
    return this.usersService.findById(req.user!.id);
  }

  /**
   * Get user by ID for administrators and managers
   */
  @Get(':id')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get user profile by ID' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@Param('id') id: string) {
    return this.usersService.findById(parseInt(id, 10));
  }

  /**
   * Update user profile
   */
  @Patch('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user name and avatar' })
  @ApiResponse({ status: 200, description: 'Updated user' })
  @ApiResponse({
    status: 400,
    description: 'Invalid profile fields; email changes are not supported',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(@Req() req: Request, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(req.user!.id, dto);
  }

  /**
   * Change password
   */
  @Post('change-password')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 204, description: 'Password changed' })
  @ApiResponse({ status: 400, description: 'Current password incorrect' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.usersService.changePassword(req.user!.id, dto);
  }
}
