import { PartialType } from '@nestjs/mapped-types';
import { CreateSuplierDto } from './create-suplier.dto';

export class UpdateSuplierDto extends PartialType(CreateSuplierDto) {}
