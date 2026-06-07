import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExeptionFilter } from './common/filters/prisma.filter';
import { Logger } from 'nestjs-pino';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Market Cosmo API')
    .setDescription('Market Cosmo API description')
    .setVersion('1.0')
    .addTag('market-cosmo')
    .build();

  const rawDocument = SwaggerModule.createDocument(app, config);
  const document = cleanupOpenApiDoc(rawDocument);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
  });

  app.useLogger(app.get(Logger));

  app.useGlobalFilters(new PrismaExeptionFilter());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3010')
      .split(',')
      .map((origin) => origin.trim()),
  });

  await app.listen(process.env.PORT ?? 3006);
}
void bootstrap();
