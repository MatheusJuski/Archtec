import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export enum CreateAccountEntryType {
  PAYABLE = 'PAYABLE',
  RECEIVABLE = 'RECEIVABLE',
}

export class CreateAccountEntryDto {
  @IsEnum(CreateAccountEntryType)
  type: CreateAccountEntryType;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsDateString()
  dueDate: string;
}
