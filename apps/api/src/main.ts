import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExeptionFilter } from './common/filters/prisma.filter';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new PrismaExeptionFilter());

  await app.listen(process.env.PORT ?? 3006);
}
void bootstrap();
