/* eslint-disable turbo/no-undeclared-env-vars */
import { config } from 'dotenv';

config({ path: ['.env.test.local', '.env'], quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required. Auth e2e tests must never use the development database.',
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/api/auth/google/callback';
process.env.WEB_URL = 'http://localhost:3010';
