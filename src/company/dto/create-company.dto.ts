import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^#([0-9A-Fa-f]{6})$/, {
    message: 'El color debe ser un código hexadecimal válido (ej: #AABBCC)',
  })
  color: string;
}
