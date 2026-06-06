import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@repo/database';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExeptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let message = 'Database error';
    let statusCode = 500;

    if (exception.code === 'P2002') {
      const target = exception.meta?.target;

      message =
        typeof target === 'string'
          ? `Unique constraint failed on field: ${target}`
          : Array.isArray(target)
            ? `Unique constraint failed on fields: ${target.join(', ')}`
            : 'Unique constraint failed on unknown fields';

      statusCode = 400;
    }

    if (exception.code === 'P2003') {
      message = 'Operation failed due to related records';
      statusCode = 409;
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error: 'Bad Request',
    });
  }
}
