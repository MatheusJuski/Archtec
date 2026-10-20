import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class CreateCalendarSourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'Cor inválida' })
  color?: string;
}

/** Campos de texto enviados junto do arquivo (multipart/form-data). */
export class ImportCalendarFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'Cor inválida' })
  color?: string;
}

export class UpdateCalendarSourceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'Cor inválida' })
  color?: string;
}
