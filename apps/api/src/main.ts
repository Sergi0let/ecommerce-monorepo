import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExeptionFilter } from './common/filters/prisma.filter';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Market Cosmo API')
    .setDescription('Market Cosmo API description')
    .setVersion('1.0')
    .addTag('market-cosmo')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory, {
    useGlobalPrefix: true,
  });

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new PrismaExeptionFilter());
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3006);
}
void bootstrap();
