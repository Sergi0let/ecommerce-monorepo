import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@repo/database';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExeptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let message = 'Database error';
    let statusCode = 500;
    let error = 'Internal Server Error';

    if (exception.code === 'P2002') {
      const target = exception.meta?.target;

      message =
        typeof target === 'string'
          ? `Resource already exists for field: ${target}`
          : Array.isArray(target)
            ? `Resource already exists for fields: ${target.join(', ')}`
            : 'Resource already exists';

      statusCode = 409;
      error = 'Conflict';
    }

    if (exception.code === 'P2003') {
      message = 'Operation failed due to related records';
      statusCode = 409;
      error = 'Conflict';
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
    });
  }
}
