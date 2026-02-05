import { IsBoolean, IsDate, IsOptional, IsString, IsIn } from 'class-validator';

export class UpdatePurchaseDto {
  @IsOptional()
  @IsIn(['created', 'processing', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsDate()
  paymentDate?: Date;

  @IsOptional()
  @IsString()
  observation?: string;
}
