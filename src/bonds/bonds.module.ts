import { Module } from '@nestjs/common';
import { BondsService } from './bonds.service';

@Module({
  providers: [BondsService],
  exports: [BondsService],
})
export class BondsModule {}
