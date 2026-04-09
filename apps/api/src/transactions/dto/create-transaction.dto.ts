import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsHexColor,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum CreateTransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum CreateTransactionRecurrenceFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
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
  @IsHexColor({ message: 'categoryColor deve ser uma cor hexadecimal válida (#RRGGBB)' })
  categoryColor?: string;

  @IsOptional()
  @IsDateString({}, { message: 'occurredAt deve ser uma data válida' })
  occurredAt?: string;

  @IsOptional()
  @IsBoolean({ message: 'isRecurring deve ser booleano' })
  isRecurring?: boolean;

  @ValidateIf((o: CreateTransactionDto) => o.isRecurring === true)
  @IsEnum(CreateTransactionRecurrenceFrequency, {
    message: 'recurrenceFrequency deve ser DAILY, WEEKLY, MONTHLY ou YEARLY quando recorrente',
  })
  recurrenceFrequency?: CreateTransactionRecurrenceFrequency;
}
