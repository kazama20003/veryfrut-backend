import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreatePurchaseItemDto {
  @IsOptional()
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsInt()
  unitMeasurementId?: number;

  @IsNumber()
  @IsPositive()
  unitCost: number;
}
