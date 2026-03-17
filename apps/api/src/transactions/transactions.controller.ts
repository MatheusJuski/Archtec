import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('summary')
  summary(
    @Request() req,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const parsedMonthValue = month ? Number(month) : null;
    const parsedYearValue = year ? Number(year) : null;

    if (
      parsedMonthValue !== null &&
      (!Number.isInteger(parsedMonthValue) || parsedMonthValue < 1 || parsedMonthValue > 12)
    ) {
      throw new BadRequestException('month deve ser um inteiro entre 1 e 12');
    }

    if (
      parsedYearValue !== null &&
      (!Number.isInteger(parsedYearValue) || parsedYearValue < 1900 || parsedYearValue > 9999)
    ) {
      throw new BadRequestException('year deve ser um inteiro válido');
    }

    const parsedMonth = parsedMonthValue ?? undefined;
    const parsedYear = parsedYearValue ?? undefined;

    return this.transactionsService.summary(req.user.userId, parsedMonth, parsedYear);
  }

  @Get()
  findAll(@Request() req) {
    return this.transactionsService.findAll(req.user.userId);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(req.user.userId, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.transactionsService.remove(req.user.userId, id);
  }
}
