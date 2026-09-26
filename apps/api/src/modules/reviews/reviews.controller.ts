import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@repo/contracts';
import type { Request } from 'express';
import { ZodSerializerDto } from 'nestjs-zod';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AdminReviewsPageDto } from './dto/admin-reviews-page.dto';
import { AdminReviewsQueryDto } from './dto/admin-reviews-query.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { PublicReviewDto } from './dto/public-review.dto';
import { PublicReviewsPageDto } from './dto/public-reviews-page.dto';
import { PublicReviewsQueryDto } from './dto/public-reviews-query.dto';
import { ReviewDto } from './dto/review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @HttpCode(HttpStatus.CREATED)
  @ZodSerializerDto(ReviewDto)
  @ApiOperation({ summary: 'Create a review' })
  @ApiResponse({ status: 201, type: ReviewDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Req() req: Request, @Body() data: CreateReviewDto) {
    return this.reviewsService.create(req.user!.id, data);
  }

  @Put('id/:id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ReviewDto)
  @ApiOperation({ summary: 'Update own review' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', required: true })
  @ApiResponse({ status: 200, type: ReviewDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  updateById(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateReviewDto,
  ) {
    return this.reviewsService.updateByUserId(req.user!.id, id, body);
  }

  @Patch('id/:id/moderation')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ReviewDto)
  @ApiOperation({ summary: 'Approve or reject a review' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', required: true })
  @ApiResponse({ status: 200, type: ReviewDto })
  @ApiResponse({ status: 404, description: 'Review not found' })
  updateModerationStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() data: ModerateReviewDto,
  ) {
    return this.reviewsService.updateModerationStatus(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete own review' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', required: true })
  @ApiResponse({ status: 204, description: 'Review deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  delete(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviewsService.deleteByUserId(req.user!.id, id);
  }

  @Delete(':id/admin')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete any review as a moderator' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', required: true })
  @ApiResponse({ status: 204, description: 'Review deleted' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  deleteByAdmin(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviewsService.delete(id);
  }

  @Get('admin')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @ZodSerializerDto(AdminReviewsPageDto)
  @ApiOperation({ summary: 'List reviews for moderation' })
  @ApiResponse({ status: 200, type: AdminReviewsPageDto })
  getAdminReviews(@Query() query: AdminReviewsQueryDto) {
    return this.reviewsService.getAdminReviews(query);
  }

  @Get()
  @ZodSerializerDto(PublicReviewsPageDto)
  @ApiOperation({ summary: 'List approved reviews' })
  @ApiResponse({ status: 200, type: PublicReviewsPageDto })
  getPublicReviews(@Query() query: PublicReviewsQueryDto) {
    return this.reviewsService.getPublicReviews(query);
  }

  @Get('id/:id')
  @ZodSerializerDto(PublicReviewDto)
  @ApiOperation({ summary: 'Get an approved review by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', required: true })
  @ApiResponse({ status: 200, type: PublicReviewDto })
  @ApiResponse({ status: 404, description: 'Approved review not found' })
  getPublicReviewById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviewsService.getApprovedById(id);
  }
}
