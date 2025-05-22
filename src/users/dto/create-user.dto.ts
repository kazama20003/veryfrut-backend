import {
  IsString,
  IsEmail,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsStrongPassword,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  @IsNotEmpty()
  role: string; // valores esperados: "admin" o "customer"

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  areaIds: number[]; // Ahora es un array de IDs de áreas

  @IsString()
  @IsNotEmpty()
  @IsStrongPassword()
  password: string;
}
