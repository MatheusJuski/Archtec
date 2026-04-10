import { IsInt, IsNumber, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateGoalDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(1900)
  @Max(9999)
  year: number;

  @IsString()
  @MinLength(1)
  category: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.01)
  targetAmount: number;
}
