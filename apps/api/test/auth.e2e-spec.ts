import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { prisma } from '@repo/database';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth integration', () => {
  let app: INestApplication;

  const userInput = {
    email: 'alice@example.com',
    password: 'Password1',
    firstName: 'Alice',
    lastName: 'Tester',
  };

  const wrongPassword = 'passworD2';

  const cleanAuthData = async () => {
    await prisma.refreshSession.deleteMany();
    await prisma.socialAccount.deleteMany();
    await prisma.user.deleteMany();
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(async () => {
    await cleanAuthData();
  });

  afterAll(async () => {
    await cleanAuthData();
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('registers a user, creates a session, and sets auth cookies', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);

      expect(response.body).toMatchObject({
        user: {
          email: userInput.email,
          firstName: userInput.firstName,
          lastName: userInput.lastName,
          role: 'CUSTOMER',
          provider: 'LOCAL',
          isEmailVerified: false,
          isActive: true,
        },
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');

      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /^access_token=.*; Max-Age=900; Path=\/; Expires=.*; HttpOnly; SameSite=Lax$/,
          ),
          expect.stringMatching(
            /^refresh_token=.*; Max-Age=2592000; Path=\/api\/auth; Expires=.*; HttpOnly; SameSite=Lax$/,
          ),
        ]),
      );

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: userInput.email },
        include: { refreshSessions: true },
      });

      expect(user.passwordHash).not.toBe(userInput.password);
      await expect(
        bcrypt.compare(userInput.password, user.passwordHash!),
      ).resolves.toBe(true);
      expect(user.refreshSessions).toHaveLength(1);
      expect(user.refreshSessions[0]?.revokedAt).toBeNull();
    });

    it('returns 409 when the email is already registered', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(409);

      expect(response.body.message).toBe('User with this email already exists');
      await expect(prisma.user.count()).resolves.toBe(1);
      await expect(prisma.refreshSession.count()).resolves.toBe(1);
    });

    it('returns 400 when password has no uppercase letter', async () => {
      const invalidPassword = {
        ...userInput,
        password: 'password1',
      };
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(invalidPassword)
        .expect(400);

      expect(response.body).toMatchObject({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ['password'],
            message: 'Password must contain at least one uppercase letter',
          }),
        ]),
      });
    });

    it('returns 400 when password has no digits', async () => {
      const invalidInput = {
        ...userInput,
        password: 'Password',
      };
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(invalidInput)
        .expect(400);

      expect(response.body).toMatchObject({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ['password'],
            message: 'Password must contain at least one digit',
          }),
        ]),
      });

      await expect(prisma.user.count()).resolves.toBe(0);
      await expect(prisma.refreshSession.count()).resolves.toBe(0);
    });

    it('400 when password has lenght less then 8', async () => {
      const invalidInput = {
        ...userInput,
        password: 'Passwor',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(invalidInput)
        .expect(400);

      expect(response.body).toMatchObject({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ['password'],
            message: 'Password must be at least 8 characters',
          }),
        ]),
      });

      await expect(prisma.user.count()).resolves.toBe(0);
      await expect(prisma.refreshSession.count()).resolves.toBe(0);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: userInput.email, password: userInput.password })
        .expect(200);

      const { email } = response.body.user;

      expect(email).toBe(userInput.email);

      const cookies = response.headers['set-cookie'] as unknown as string[];

      expect(cookies).toBeDefined();
      expect(cookies).toHaveLength(2);

      expect(cookies).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^access_token=/),
          expect.stringMatching(/^refresh_token=/),
        ]),
      );

      await expect(prisma.refreshSession.count()).resolves.toBe(2);
    });

    it('returns 401 for a wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: userInput.email, password: userInput.password }) // register → створив 1 сесію
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: userInput.email, password: wrongPassword })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');

      await expect(prisma.refreshSession.count()).resolves.toBe(1); // невдалий login → не створив нової сесії
    });

    it('returns 401 for a disabled user', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: userInput.email, password: userInput.password })
        .expect(201);

      const updateUser = await prisma.user.update({
        where: { email: userInput.email },
        data: { isActive: false },
      });

      expect(updateUser.isActive).toEqual(false);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: userInput.email, password: userInput.password })
        .expect(401);

      expect(response.body.message).toBe('Account is disabled');

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: userInput.email },
        include: { refreshSessions: true },
      });
      expect(user.refreshSessions).toHaveLength(1);

      const cookies = response.headers['set-cookie'] as unknown as string[];

      expect(cookies).toBeUndefined();
    });

    it('not existing email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: userInput.email,
          password: userInput.password,
        })
        .expect(201);

      await expect(prisma.refreshSession.count()).resolves.toBe(1);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'wrong@email.com', password: userInput.password })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });
  });

  describe('GET /api/users/me', () => {
    it('returns the current user when access token cookie is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);

      const agent = request.agent(app.getHttpServer());

      await agent
        .post('/api/auth/login')
        .send({
          email: userInput.email,
          password: userInput.password,
        })
        .expect(200);

      const response = await agent.get('/api/users/me').expect(200);

      expect(response.body).toMatchObject({
        email: userInput.email,
        firstName: userInput.firstName,
        lastName: userInput.lastName,
      });
    });

    it('returns 401 without an access token', async () => {
      await request(app.getHttpServer()).get('/api/users/me').expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns 401 without a refresh token', async () => {
      await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
    });
    it('return 401 for an invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', 'refresh_token=not-a-valid-jwt')
        .expect(401);
    });
    it('returns 401 when a refresh token is reused', async () => {
      const agent = request.agent(app.getHttpServer());

      const registerResponse = await agent
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);

      const registerCookies = registerResponse.headers[
        'set-cookie'
      ] as unknown as string[];

      const initialRefreshCookie = registerCookies.find((cookie) =>
        cookie.startsWith('refresh_token='),
      );

      expect(initialRefreshCookie).toBeDefined();

      await agent.post('/api/auth/refresh').expect(200);

      if (!initialRefreshCookie) {
        throw new Error('refresh_token cookie is missing');
      }

      const oldRefreshTokenCookie = initialRefreshCookie.split(';')[0]!;

      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', oldRefreshTokenCookie)
        .expect(401);

      expect(response.body.message).toBe('Invalid refresh token');
    });
    it('rotates refresh session and sets new auth cookies', async () => {
      const agent = request.agent(app.getHttpServer());

      const registerResponse = await agent
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);

      const registerCookies = registerResponse.headers[
        'set-cookie'
      ] as unknown as string[];
      const initialRefreshCookie = registerCookies.find((cookie) =>
        cookie.startsWith('refresh_token='),
      );
      const initialSession = await prisma.refreshSession.findFirstOrThrow({
        where: { revokedAt: null },
      });

      const response = await agent.post('/api/auth/refresh').expect(200);

      const cookies = response.headers['set-cookie'] as unknown as string[];
      const rotatedRefreshCookie = cookies.find((cookie) =>
        cookie.startsWith('refresh_token='),
      );

      expect(cookies).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^access_token=/),
          expect.stringMatching(/^refresh_token=/),
        ]),
      );
      expect(initialRefreshCookie).toBeDefined();
      expect(rotatedRefreshCookie).toBeDefined();
      expect(rotatedRefreshCookie?.split(';')[0]).not.toBe(
        initialRefreshCookie?.split(';')[0],
      );

      const revokedSession = await prisma.refreshSession.findUniqueOrThrow({
        where: { id: initialSession.id },
      });
      const activeSessions = await prisma.refreshSession.findMany({
        where: { revokedAt: null },
      });

      expect(revokedSession.revokedAt).not.toBeNull();
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0]?.id).not.toBe(initialSession.id);
      await expect(prisma.refreshSession.count()).resolves.toBe(2);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes the refresh session and clears auth cookies', async () => {
      const agent = request.agent(app.getHttpServer());

      await agent.post('/api/auth/register').send(userInput).expect(201);

      const initialSession = await prisma.refreshSession.findFirstOrThrow({
        where: { revokedAt: null },
      });

      const response = await agent.post('/api/auth/logout').expect(204);

      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^access_token=;/),
          expect.stringMatching(/^refresh_token=;/),
        ]),
      );

      const revokedSession = await prisma.refreshSession.findUniqueOrThrow({
        where: { id: initialSession.id },
      });

      expect(revokedSession.revokedAt).not.toBeNull();
    });
  });

  describe('GET /api/users/me', () => {
    it('returns 401 after logout', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.post('/api/auth/register').send(userInput).expect(201);

      await agent.post('/api/auth/logout').expect(204);

      await agent.get('/api/users/me').expect(401);
    });
  });

  describe('POST /api/auth/request-password-reset', () => {
    const errorMessage = 'If the account exists, a reset email has been sent';

    it('returns 200 and does not reveal if the email exists', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({ email: userInput.email })
        .expect(200);

      expect(response.body.message).toBe(errorMessage);

      const response2 = await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({ email: 'wrong@gmail.com' })
        .expect(200);

      expect(response2.body.message).toBe(errorMessage);
      await expect(prisma.passwordResetToken.count()).resolves.toBe(1);
    });

    it('request create a token in db', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({ email: userInput.email })
        .expect(200);

      expect(response.body).toEqual({
        message: errorMessage,
      });

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: userInput.email },
      });

      const token = await prisma.passwordResetToken.findFirstOrThrow({
        where: { userId: user.id },
      });

      expect(token.userId).toBe(user.id);
      expect(token.usedAt).toBeNull();
      expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
      await expect(
        prisma.passwordResetToken.count({
          where: { userId: user.id },
        }),
      ).resolves.toBe(1);
      expect(token.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('request create a token in db and delete old tokens', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);

      const response1 = await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({ email: userInput.email })
        .expect(200);

      expect(response1.body).toEqual({
        message: errorMessage,
      });

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: userInput.email },
      });

      const token1 = await prisma.passwordResetToken.findFirstOrThrow({
        where: { userId: user.id },
      });

      expect(token1.userId).toBe(user.id);
      expect(token1.usedAt).toBeNull();
      expect(token1.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const response2 = await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({ email: userInput.email })
        .expect(200);

      expect(response2.body).toEqual({
        message: errorMessage,
      });

      const token2 = await prisma.passwordResetToken.findFirstOrThrow({
        where: { userId: user.id },
      });

      expect(token2.userId).toBe(user.id);
      expect(token2.usedAt).toBeNull();
      expect(token2.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(token2.id).not.toBe(token1.id);

      await expect(
        prisma.passwordResetToken.count({
          where: { userId: user.id },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.passwordResetToken.findUnique({
          where: { id: token1.id },
        }),
      ).resolves.toBeNull();
    });
  });

  describe('POST /api/auth/email-verification/resend', () => {
    it('returns 204 for an authorized request and creates a token', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.post('/api/auth/register').send(userInput).expect(201);

      await agent
        .post('/api/auth/login')
        .send({ email: userInput.email, password: userInput.password })
        .expect(200);

      await agent.post('/api/auth/email-verification/resend').expect(204);

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: userInput.email },
      });

      const token = await prisma.emailVerificationToken.findFirstOrThrow({
        where: { userId: user.id },
      });

      expect(token.userId).toBe(user.id);
      expect(token.usedAt).toBeNull();
      expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
      await expect(
        prisma.emailVerificationToken.count({
          where: { userId: user.id },
        }),
      ).resolves.toBe(1);
    });
    it('returns 401 unauthorized request', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/email-verification/resend')
        .send({ email: userInput.email })
        .expect(401);
    });

    it('replaces the previous unused verification token', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.post('/api/auth/register').send(userInput).expect(201);

      await agent.post('/api/auth/email-verification/resend').expect(204);
      const firstToken = await prisma.emailVerificationToken.findFirstOrThrow();

      await agent.post('/api/auth/email-verification/resend').expect(204);
      const tokens = await prisma.emailVerificationToken.findMany();

      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.id).not.toBe(firstToken.id);
    });

    it('does not create a token for an already verified email', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.post('/api/auth/register').send(userInput).expect(201);
      await prisma.user.update({
        where: { email: userInput.email },
        data: { isEmailVerified: true },
      });

      await agent.post('/api/auth/email-verification/resend').expect(204);
      await expect(prisma.emailVerificationToken.count()).resolves.toBe(0);
    });

    it('invalidates a token created before a resend', async () => {
      const rawToken = 'token-before-resend';
      const agent = request.agent(app.getHttpServer());
      await agent.post('/api/auth/register').send(userInput).expect(201);
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: userInput.email },
      });
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash('sha256').update(rawToken).digest('hex'),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await agent.post('/api/auth/email-verification/resend').expect(204);

      await request(app.getHttpServer())
        .post('/api/auth/email-verification/verify')
        .send({ token: rawToken })
        .expect(400);
    });
  });

  describe('POST /api/auth/email-verification/verify', () => {
    const rawToken = 'valid-email-verification-token';

    const createVerificationToken = async (
      expiresAt = new Date(Date.now() + 60 * 60 * 1000),
    ) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: userInput.email },
      });

      return prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash('sha256').update(rawToken).digest('hex'),
          expiresAt,
        },
      });
    };

    it('verifies the email and consumes the token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);
      const token = await createVerificationToken();

      await request(app.getHttpServer())
        .post('/api/auth/email-verification/verify')
        .send({ token: rawToken })
        .expect(204);
      await expect(
        prisma.user.findUniqueOrThrow({
          where: { email: userInput.email },
          select: { isEmailVerified: true },
        }),
      ).resolves.toEqual({ isEmailVerified: true });
      await expect(
        prisma.emailVerificationToken.findUniqueOrThrow({
          where: { id: token.id },
          select: { usedAt: true },
        }),
      ).resolves.toMatchObject({ usedAt: expect.any(Date) });
    });

    it('returns 400 for an invalid or reused token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);
      await createVerificationToken();

      await request(app.getHttpServer())
        .post('/api/auth/email-verification/verify')
        .send({ token: 'invalid-token' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/auth/email-verification/verify')
        .send({ token: rawToken })
        .expect(204);

      const response = await request(app.getHttpServer())
        .post('/api/auth/email-verification/verify')
        .send({ token: rawToken })
        .expect(400);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('returns 400 for an expired token without verifying the email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);
      await createVerificationToken(new Date(Date.now() - 1_000));

      const response = await request(app.getHttpServer())
        .post('/api/auth/email-verification/verify')
        .send({ token: rawToken })
        .expect(400);

      expect(response.body.message).toBe('Invalid or expired token');
      await expect(
        prisma.user.findUniqueOrThrow({
          where: { email: userInput.email },
          select: { isEmailVerified: true },
        }),
      ).resolves.toEqual({ isEmailVerified: false });
    });

    it('returns 400 for a valid token when the email is already verified', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);
      const token = await createVerificationToken();
      await prisma.user.update({
        where: { email: userInput.email },
        data: { isEmailVerified: true },
      });

      await request(app.getHttpServer())
        .post('/api/auth/email-verification/verify')
        .send({ token: rawToken })
        .expect(400);

      await expect(
        prisma.emailVerificationToken.findUniqueOrThrow({
          where: { id: token.id },
          select: { usedAt: true },
        }),
      ).resolves.toEqual({ usedAt: null });
    });

    it('allows only one of two concurrent verification requests', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(userInput)
        .expect(201);
      await createVerificationToken();

      const responses = await Promise.all([
        request(app.getHttpServer())
          .post('/api/auth/email-verification/verify')
          .send({ token: rawToken }),
        request(app.getHttpServer())
          .post('/api/auth/email-verification/verify')
          .send({ token: rawToken }),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([204, 400]);
    });
  });
});
