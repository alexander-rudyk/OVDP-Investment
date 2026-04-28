import { Module } from '@nestjs/common';
import { FxModule } from '../fx/fx.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { PortfolioCalculator } from './calculators/portfolio-calculator';
import { PortfolioService } from './portfolio.service';

@Module({
  imports: [FxModule, PurchasesModule],
  providers: [PortfolioService, PortfolioCalculator],
  exports: [PortfolioService, PortfolioCalculator],
})
export class PortfolioModule {}
