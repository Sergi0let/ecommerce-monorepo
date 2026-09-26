import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, ReviewStatus, type Review } from '@repo/database';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminReviewsQueryDto } from './dto/admin-reviews-query.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { PublicReviewsQueryDto } from './dto/public-reviews-query.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

const publicReviewSelect = {
  id: true,
  productId: true,
  rating: true,
  comment: true,
  verifiedPurchase: true,
  helpfulCount: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      firstName: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.ReviewSelect;

type PublicReviewRecord = Prisma.ReviewGetPayload<{
  select: typeof publicReviewSelect;
}>;

@Injectable()
export class ReviewsService {
  private static readonly maxTransactionAttempts = 3;
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, data: CreateReviewDto) {
    this.logger.log('Creating review');

    const review = await this.prisma.client.review.create({
      data: {
        rating: data.rating,
        comment: data.comment,
        productId: data.productId,
        userId,
      },
    });

    return this.toReviewResponse(review);
  }

  async updateByUserId(userId: number, id: string, data: UpdateReviewDto) {
    const review = await this.withRatingTransaction(async (transaction) => {
      const existingReview = await transaction.review.findFirst({
        where: { id, userId },
      });

      if (!existingReview) {
        throw new NotFoundException('Review not found');
      }

      const updatedReview = await transaction.review.update({
        where: { id },
        data: { ...data, status: ReviewStatus.PENDING },
      });

      await this.recalculateProductRating(
        transaction,
        existingReview.productId,
      );

      return updatedReview;
    });

    return this.toReviewResponse(review);
  }

  async deleteByUserId(userId: number, id: string): Promise<void> {
    this.logger.log('User deleting review ' + id);

    await this.withRatingTransaction(async (transaction) => {
      const review = await transaction.review.findFirst({
        where: { id, userId },
      });

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      await transaction.review.delete({ where: { id } });
      await this.recalculateProductRating(transaction, review.productId);
    });

    this.logger.log('User review ' + id + ' deleted successfully');
  }

  async delete(id: string): Promise<void> {
    this.logger.log('Deleting review ' + id);

    await this.withRatingTransaction(async (transaction) => {
      const review = await transaction.review.findUnique({ where: { id } });

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      await transaction.review.delete({ where: { id } });
      await this.recalculateProductRating(transaction, review.productId);
    });

    this.logger.log('Review ' + id + ' deleted successfully');
  }

  async updateModerationStatus(id: string, data: ModerateReviewDto) {
    const review = await this.withRatingTransaction(async (transaction) => {
      const existingReview = await transaction.review.findUnique({
        where: { id },
      });

      if (!existingReview) {
        throw new NotFoundException('Review not found');
      }

      const updatedReview = await transaction.review.update({
        where: { id },
        data: { status: data.status },
      });

      await this.recalculateProductRating(
        transaction,
        existingReview.productId,
      );

      return updatedReview;
    });

    return this.toReviewResponse(review);
  }

  async getPublicReviews(query: PublicReviewsQueryDto) {
    const { limit = 10, page = 1, productId } = query;
    const {
      skip,
      take,
      page: safePage,
    } = this.normalizePagination(page, limit);
    const where: Prisma.ReviewWhereInput = {
      status: ReviewStatus.APPROVED,
      ...(productId ? { productId } : {}),
    };

    const [reviews, total] = await Promise.all([
      this.prisma.client.review.findMany({
        where,
        select: publicReviewSelect,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.client.review.count({ where }),
    ]);

    return {
      data: reviews.map((review) => this.toPublicReviewResponse(review)),
      total,
      page: safePage,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async getApprovedById(id: string) {
    const review = await this.prisma.client.review.findFirst({
      where: { id, status: ReviewStatus.APPROVED },
      select: publicReviewSelect,
    });

    if (!review) {
      throw new NotFoundException('Approved review not found');
    }

    return this.toPublicReviewResponse(review);
  }

  async getAdminReviews(query: AdminReviewsQueryDto) {
    const { limit = 10, page = 1, productId, status } = query;
    const {
      skip,
      take,
      page: safePage,
    } = this.normalizePagination(page, limit);
    const where: Prisma.ReviewWhereInput = {
      ...(productId ? { productId } : {}),
      ...(status ? { status } : {}),
    };

    const [reviews, total] = await Promise.all([
      this.prisma.client.review.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.client.review.count({ where }),
    ]);

    return {
      data: reviews.map((review) => this.toReviewResponse(review)),
      total,
      page: safePage,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  private normalizePagination(page: number, limit: number) {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    return {
      page: safePage,
      take: safeLimit,
      skip: (safePage - 1) * safeLimit,
    };
  }

  private toReviewResponse(review: Review) {
    return {
      ...review,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
  }

  private toPublicReviewResponse(review: PublicReviewRecord) {
    const { user, createdAt, updatedAt, ...publicReview } = review;

    return {
      ...publicReview,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      author: user,
    };
  }

  private async recalculateProductRating(
    transaction: Prisma.TransactionClient,
    productId: string,
  ): Promise<void> {
    const aggregate = await transaction.review.aggregate({
      where: { productId, status: ReviewStatus.APPROVED },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await transaction.product.update({
      where: { id: productId },
      data: {
        ratingAvg: aggregate._avg.rating,
        ratingCount: aggregate._count.rating,
      },
    });
  }

  private async withRatingTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (
      let attempt = 1;
      attempt <= ReviewsService.maxTransactionAttempts;
      attempt += 1
    ) {
      try {
        return await this.prisma.client.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const isSerializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (!isSerializationConflict) {
          throw error;
        }

        if (attempt === ReviewsService.maxTransactionAttempts) {
          throw new ServiceUnavailableException(
            'Review rating is being updated; please retry',
          );
        }
      }
    }

    throw new ServiceUnavailableException(
      'Review rating is being updated; please retry',
    );
  }
}
