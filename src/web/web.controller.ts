import { Controller, Get, Header } from '@nestjs/common';
import { WebDashboardService } from './web-dashboard.service';
import { renderDashboard } from './web-renderer';

@Controller()
export class WebController {
  constructor(private readonly dashboard: WebDashboardService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async index(): Promise<string> {
    return renderDashboard(await this.dashboard.getDashboard());
  }
}
