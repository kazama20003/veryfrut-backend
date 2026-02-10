import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdatePurchaseItemDto {
  @IsOptional()
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsInt()
  unitMeasurementId?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  unitCost?: number;
}
