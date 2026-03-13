import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export enum CreateTransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export class CreateTransactionDto {
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: 'Valor inválido' })
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  amount: number;

  @IsEnum(CreateTransactionType, { message: 'Tipo deve ser INCOME ou EXPENSE' })
  type: CreateTransactionType;

  @IsString({ message: 'Categoria é obrigatória' })
  @MinLength(1, { message: 'Categoria é obrigatória' })
  category: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'occurredAt deve ser uma data válida' })
  occurredAt?: string;
}
