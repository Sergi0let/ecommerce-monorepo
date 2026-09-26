import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PublicReviewsResponseSchema, UserRole } from '@repo/contracts';
import { prisma } from '@repo/database';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExeptionFilter } from '../src/common/filters/prisma.filter';
import { MailService } from '../src/modules/mail/mail.service';

describe('Reviews integration', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const fixtureId = randomUUID();
  const brandId = randomUUID();
  const productId = randomUUID();
  const userIds: number[] = [];
  let ownerId: number;
  let otherUserId: number;
  let adminId: number;

  const tokenFor = async (id: number, role: UserRole) =>
    jwtService.signAsync(
      { id, email: `${id}@example.com`, role },
      { secret: 'test-access-secret', expiresIn: '15m' },
    );

  const createUser = async (role: UserRole, firstName: string) => {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.com`,
        firstName,
        avatarUrl: 'https://example.com/avatar.png',
        role,
      },
    });
    userIds.push(user.id);
    return user;
  };

  const createReview = async (
    userId: number,
    role: UserRole,
    rating: number,
  ) => {
    const token = await tokenFor(userId, role);
    return request(app.getHttpServer())
      .post('/api/reviews')
      .auth(token, { type: 'bearer' })
      .send({ productId, rating })
      .expect(201);
  };

  const cleanReviews = async () => {
    await prisma.review.deleteMany({ where: { productId } });
    await prisma.product.update({
      where: { id: productId },
      data: { ratingAvg: null, ratingCount: 0 },
    });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new PrismaExeptionFilter());
    await app.init();
    jwtService = app.get(JwtService);

    const [owner, otherUser, admin] = await Promise.all([
      createUser(UserRole.CUSTOMER, 'Owner'),
      createUser(UserRole.CUSTOMER, 'Other'),
      createUser(UserRole.ADMIN, 'Admin'),
    ]);
    ownerId = owner.id;
    otherUserId = otherUser.id;
    adminId = admin.id;

    await prisma.brand.create({
      data: {
        id: brandId,
        name: 'Reviews fixture',
        slug: `reviews-${fixtureId}`,
      },
    });
    await prisma.product.create({
      data: {
        id: productId,
        name: 'Reviews fixture product',
        slug: `reviews-${fixtureId}`,
        brandId,
      },
    });
  });

  beforeEach(cleanReviews);

  afterAll(async () => {
    try {
      await prisma.product.deleteMany({ where: { id: productId } });
      await prisma.brand.deleteMany({ where: { id: brandId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app?.close();
    }
  });

  it('shows only approved reviews publicly and exposes a safe author view', async () => {
    const review = await createReview(ownerId, UserRole.CUSTOMER, 5);
    const adminToken = await tokenFor(adminId, UserRole.ADMIN);

    const pendingPublicList = await request(app.getHttpServer())
      .get(`/api/reviews?productId=${productId}`)
      .expect(200);
    expect(pendingPublicList.body).toMatchObject({ data: [], total: 0 });

    await request(app.getHttpServer())
      .get(`/api/reviews/id/${review.body.id}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/reviews/admin?status=PENDING')
      .auth(await tokenFor(ownerId, UserRole.CUSTOMER), { type: 'bearer' })
      .expect(403);

    const adminList = await request(app.getHttpServer())
      .get('/api/reviews/admin?status=PENDING')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(adminList.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: review.body.id, userId: ownerId }),
      ]),
    );

    await request(app.getHttpServer())
      .patch(`/api/reviews/id/${review.body.id}/moderation`)
      .auth(adminToken, { type: 'bearer' })
      .send({ status: 'APPROVED' })
      .expect(200);

    const publicList = await request(app.getHttpServer())
      .get(`/api/reviews?productId=${productId}&page=1&limit=1`)
      .expect(200);
    expect(PublicReviewsResponseSchema.safeParse(publicList.body).success).toBe(
      true,
    );
    expect(publicList.body.data[0]).toMatchObject({
      id: review.body.id,
      rating: 5,
      author: {
        firstName: 'Owner',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
    expect(publicList.body.data[0]).not.toHaveProperty('userId');
    expect(publicList.body).toMatchObject({
      total: 1,
      page: 1,
      limit: 1,
      totalPages: 1,
    });
  });

  it('enforces ownership, returns edited reviews to pending, and maintains ratings', async () => {
    const review = await createReview(ownerId, UserRole.CUSTOMER, 5);
    const ownerToken = await tokenFor(ownerId, UserRole.CUSTOMER);
    const otherToken = await tokenFor(otherUserId, UserRole.CUSTOMER);
    const adminToken = await tokenFor(adminId, UserRole.ADMIN);

    await request(app.getHttpServer())
      .post('/api/reviews')
      .auth(ownerToken, { type: 'bearer' })
      .send({ productId, rating: 4 })
      .expect(409);

    await request(app.getHttpServer())
      .put(`/api/reviews/id/${review.body.id}`)
      .auth(otherToken, { type: 'bearer' })
      .send({ rating: 1 })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/reviews/id/${review.body.id}/moderation`)
      .auth(adminToken, { type: 'bearer' })
      .send({ status: 'APPROVED' })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/reviews/id/${review.body.id}`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ rating: 2 })
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('PENDING'));

    expect(
      await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
    ).toMatchObject({ ratingAvg: null, ratingCount: 0 });

    await request(app.getHttpServer())
      .patch(`/api/reviews/id/${review.body.id}/moderation`)
      .auth(adminToken, { type: 'bearer' })
      .send({ status: 'APPROVED' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/reviews/${review.body.id}`)
      .auth(otherToken, { type: 'bearer' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/reviews/${review.body.id}`)
      .auth(ownerToken, { type: 'bearer' })
      .expect(204);

    expect(
      await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
    ).toMatchObject({ ratingAvg: null, ratingCount: 0 });
  });

  it('keeps aggregates consistent when moderation requests run concurrently', async () => {
    const firstReview = await createReview(ownerId, UserRole.CUSTOMER, 4);
    const secondReview = await createReview(otherUserId, UserRole.CUSTOMER, 5);
    const adminToken = await tokenFor(adminId, UserRole.ADMIN);

    await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/reviews/id/${firstReview.body.id}/moderation`)
        .auth(adminToken, { type: 'bearer' })
        .send({ status: 'APPROVED' })
        .expect(200),
      request(app.getHttpServer())
        .patch(`/api/reviews/id/${secondReview.body.id}/moderation`)
        .auth(adminToken, { type: 'bearer' })
        .send({ status: 'APPROVED' })
        .expect(200),
    ]);

    expect(
      await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
    ).toMatchObject({ ratingAvg: 4.5, ratingCount: 2 });
  });
});
