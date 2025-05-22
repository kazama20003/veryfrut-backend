import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  IsUrl,
  IsArray,
  ArrayNotEmpty,
  Min,
  Max,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  price: number;

  @IsNumber()
  @Min(0)
  @Max(2147483647) // límite máximo para int
  stock: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsNumber()
  categoryId: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  unitMeasurementIds: number[]; // Cambiado a array para muchos a muchos
}
