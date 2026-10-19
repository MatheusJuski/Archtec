import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [PrismaModule, TransactionsModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
