import { Injectable } from '@nestjs/common';
import { Category } from '@repo/database';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getAllCategories(): Promise<Category[]> {
    return this.prisma.client.category.findMany({});
  }
}
