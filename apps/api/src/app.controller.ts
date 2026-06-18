import { Controller, Get } from '@nestjs/common';
import { Category } from '@repo/database';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health/db')
  async getDbHealth(): Promise<{ ok: true; categories: Category[] }> {
    const categories = await this.appService.getAllCategories();
    return { ok: true, categories };
  }
}
