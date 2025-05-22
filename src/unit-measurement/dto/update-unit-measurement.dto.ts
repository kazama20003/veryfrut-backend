import { PartialType } from '@nestjs/mapped-types';
import { CreateUnitMeasurementDto } from './create-unit-measurement.dto';

export class UpdateUnitMeasurementDto extends PartialType(
  CreateUnitMeasurementDto,
) {}
