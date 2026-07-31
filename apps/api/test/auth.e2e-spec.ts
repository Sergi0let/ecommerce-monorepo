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
});
