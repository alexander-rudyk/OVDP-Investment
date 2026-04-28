import { Module } from '@nestjs/common';
import { BondsModule } from '../bonds/bonds.module';
import { FxModule } from '../fx/fx.module';
import { PurchasesService } from './purchases.service';

@Module({
  imports: [BondsModule, FxModule],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
