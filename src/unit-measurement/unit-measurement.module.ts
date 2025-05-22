import { Module } from '@nestjs/common';
import { UnitMeasurementService } from './unit-measurement.service';
import { UnitMeasurementController } from './unit-measurement.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [UnitMeasurementController],
  providers: [UnitMeasurementService],
  imports: [PrismaModule],
})
export class UnitMeasurementModule {}
