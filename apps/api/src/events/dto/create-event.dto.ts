import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export enum EventRecurrenceFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  /** Dia inteiro: startTime/endTime à meia-noite UTC, com fim exclusivo (padrão iCal). */
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsUUID()
  noteId?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ValidateIf((o: CreateEventDto) => o.isRecurring === true)
  @IsEnum(EventRecurrenceFrequency)
  recurrenceFrequency?: EventRecurrenceFrequency;
}
