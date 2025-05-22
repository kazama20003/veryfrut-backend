import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateUnitMeasurementDto {
  @IsString()
  @IsNotEmpty()
  name: string; // El nombre de la unidad de medida (Ej: "Kg", "L", "Und")

  @IsOptional()
  @IsString()
  description?: string; // Descripción de la unidad de medida (Ej: "Kilogramos", "Litros", etc.)
}
