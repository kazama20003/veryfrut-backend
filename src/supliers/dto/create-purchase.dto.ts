import {
  IsInt,
  IsNumber,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  IsPositive,
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

  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  @ArrayMinSize(1)
  purchaseItems: CreatePurchaseItemDto[];
}
