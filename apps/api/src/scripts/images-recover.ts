import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ImageRecoveryOptionsSchema } from '@repo/contracts';
import { parseArgs } from 'node:util';
import { ImageRecoveryService } from '../modules/product-images/image-recovery.service';
import { ProductImageStorageModule } from '../modules/product-images/product-image-storage.module';

@Module({ imports: [ConfigModule.forRoot(), ProductImageStorageModule] })
class RecoveryModule {}

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean', default: false },
      apply: { type: 'boolean', default: false },
      'remove-broken-records': { type: 'boolean', default: false },
      'grace-hours': { type: 'string', default: '24' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: pnpm --filter api images:recover [--apply] [--grace-hours 24] [--remove-broken-records]',
    );
    console.log(
      'Default: read-only dry run. Minimum grace: 1 hour. --apply deletes aged orphan objects and retries queued cleanup. --remove-broken-records additionally removes incomplete image records.',
    );
    return;
  }
  const options = ImageRecoveryOptionsSchema.parse({
    apply: values.apply,
    removeBrokenRecords: values['remove-broken-records'],
    graceHours: values['grace-hours'],
  });
  const app = await NestFactory.createApplicationContext(RecoveryModule, {
    logger: ['error', 'warn', 'log'],
    abortOnError: false,
  });
  try {
    const result = await app
      .get(ImageRecoveryService)
      .run(options, (event) => console.log(JSON.stringify(event)));
    console.log(JSON.stringify(result));
    if (result.failures) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main().catch(() => {
  // Do not print SDK/Prisma errors, which can include connection information.
  console.error(
    'Image recovery failed. Check options, database and storage access.',
  );
  process.exitCode = 1;
});
