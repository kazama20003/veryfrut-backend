import { Module } from '@nestjs/common';
import { AreasService } from './areas.service';
import { AreasController } from './areas.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
@Module({
  controllers: [AreasController],
  providers: [AreasService],
  imports: [PrismaModule],
})
export class AreasModule {}
