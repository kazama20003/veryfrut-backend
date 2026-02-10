import {
  IsInt,
  IsNumber,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  IsPositive,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePurchaseItemDto } from './create-purchase-item.dto';
export class CreatePurchaseDto {
  @IsOptional()
  @IsInt()
  areaId?: number | null;

  @IsNumber()
  @IsPositive()
  totalAmount: number;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string; // 👈 fecha enviada por el front (ISO o YYYY-MM-DD)

  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  @ArrayMinSize(1)
  purchaseItems: CreatePurchaseItemDto[];
}
