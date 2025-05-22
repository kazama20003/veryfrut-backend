import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UnitMeasurementService } from './unit-measurement.service';
import { CreateUnitMeasurementDto } from './dto/create-unit-measurement.dto';
import { UpdateUnitMeasurementDto } from './dto/update-unit-measurement.dto';

@Controller('unit-measurements')
export class UnitMeasurementController {
  constructor(
    private readonly unitMeasurementService: UnitMeasurementService,
  ) {}

  @Post()
  create(@Body() createUnitMeasurementDto: CreateUnitMeasurementDto) {
    return this.unitMeasurementService.create(createUnitMeasurementDto);
  }

  @Get()
  findAll() {
    return this.unitMeasurementService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.unitMeasurementService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUnitMeasurementDto: UpdateUnitMeasurementDto,
  ) {
    return this.unitMeasurementService.update(+id, updateUnitMeasurementDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.unitMeasurementService.remove(+id);
  }
}
