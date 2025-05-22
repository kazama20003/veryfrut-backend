import { IsOptional, IsISO8601, IsString } from 'class-validator';

export class CheckOrderDto {
  @IsOptional()
  @IsString()
  areaId?: string;

  @IsOptional()
  @IsISO8601()
  date?: string;
}
