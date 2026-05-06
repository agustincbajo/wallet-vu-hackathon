import { Controller, Get, HttpCode } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  @HttpCode(200)
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('readiness')
  @HttpCode(200)
  readiness(): { status: string } {
    return { status: 'ready' };
  }
}
