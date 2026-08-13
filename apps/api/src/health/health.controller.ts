import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async check() {
    const started = Date.now();
    await this.db.query('SELECT 1');
    return {
      status: 'ok',
      product: 'PISMA',
      version: '1.3.0',
      dbMs: Date.now() - started,
      time: new Date().toISOString(),
    };
  }
}
