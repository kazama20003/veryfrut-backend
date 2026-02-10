import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';

export class UpdatePurchaseDto {
  @IsOptional()
  @IsIn(['created', 'processing', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  observation?: string;
}
