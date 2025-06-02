import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatus {
  CREATED = 'created',
  PROCESS = 'process',
  DELIVERED = 'delivered',
}

class CreateOrderItemDto {
  @IsNumber()
  @IsPositive()
  productId: number;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  price: number;

  @IsNumber()
  @IsPositive()
  unitMeasurementId: number;
}

export class CreateOrderDto {
  @IsNumber()
  @IsPositive()
  userId: number;

  @IsNumber()
  @IsPositive()
  areaId: number;

  @IsNumber()
  totalAmount: number;

  @IsEnum(OrderStatus, {
    message: 'Status must be one of: created, process, delivered',
  })
  status: OrderStatus;

  @IsOptional()
  @IsString()
  observation?: string; // ← Campo agregado

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  orderItems: CreateOrderItemDto[];
}
