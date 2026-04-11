import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAccountEntryDto } from './dto/create-account-entry.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { FinanceService } from './finance.service';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('goals')
  goals(@Request() req, @Query('month') month?: string, @Query('year') year?: string) {
    const now = new Date();
    const parsedMonth = month ? Number(month) : now.getMonth() + 1;
    const parsedYear = year ? Number(year) : now.getFullYear();
    return this.financeService.getGoals(req.user.userId, parsedMonth, parsedYear);
  }

  @Post('goals')
  upsertGoal(@Request() req, @Body() dto: CreateGoalDto) {
    return this.financeService.upsertGoal(req.user.userId, dto);
  }

  @Delete('goals/:id')
  deleteGoal(@Request() req, @Param('id') id: string) {
    return this.financeService.deleteGoal(req.user.userId, id);
  }

  @Get('accounts')
  listAccounts(@Request() req, @Query('month') month?: string, @Query('year') year?: string) {
    const parsedMonth = month ? Number(month) : undefined;
    const parsedYear = year ? Number(year) : undefined;
    return this.financeService.listAccounts(req.user.userId, parsedMonth, parsedYear);
  }

  @Post('accounts')
  createAccount(@Request() req, @Body() dto: CreateAccountEntryDto) {
    return this.financeService.createAccount(req.user.userId, dto);
  }

  @Post('accounts/:id/pay')
  markPaid(@Request() req, @Param('id') id: string) {
    return this.financeService.markAccountPaid(req.user.userId, id);
  }

  @Delete('accounts/:id')
  deleteAccount(@Request() req, @Param('id') id: string) {
    return this.financeService.deleteAccount(req.user.userId, id);
  }

  @Get('health-summary')
  healthSummary(@Request() req) {
    return this.financeService.healthSummary(req.user.userId);
  }

  @Get('insights')
  insights(@Request() req, @Query('month') month?: string, @Query('year') year?: string) {
    const parsedMonth = month ? Number(month) : undefined;
    const parsedYear = year ? Number(year) : undefined;
    return this.financeService.monthInsights(req.user.userId, parsedMonth, parsedYear);
  }
}
