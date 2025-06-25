import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class CreateAreaDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @IsNotEmpty()
  companyId: number;

  @IsString()
  @IsOptional()
  color?: string; // Campo opcional para el color
}
