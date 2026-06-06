import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExeptionFilter } from './common/filters/prisma.filter';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new PrismaExeptionFilter());
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3006);
}
void bootstrap();
