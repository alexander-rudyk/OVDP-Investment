import { Module } from '@nestjs/common';
import { WebController } from './web.controller';
import { WebDashboardService } from './web-dashboard.service';

@Module({
  controllers: [WebController],
  providers: [WebDashboardService],
})
export class WebModule {}
