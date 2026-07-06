import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { PrismaExeptionFilter } from './common/filters/prisma.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Market Cosmo API')
    .setDescription('Market Cosmo API description')
    .setVersion('1.0')
    .addBearerAuth()
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

  await app.listen(configService.get('PORT') ?? 3006);
}
void bootstrap();
