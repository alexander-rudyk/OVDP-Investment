import { Module } from '@nestjs/common';
import { FxModule } from '../fx/fx.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { PortfolioAggregateCalculator } from './calculators/portfolio-aggregate-calculator';
import { PortfolioCalculator } from './calculators/portfolio-calculator';
import { PortfolioService } from './portfolio.service';

@Module({
  imports: [FxModule, PurchasesModule],
  providers: [PortfolioService, PortfolioCalculator, PortfolioAggregateCalculator],
  exports: [PortfolioService, PortfolioCalculator],
})
export class PortfolioModule {}
