import { Module } from '@nestjs/common';
import { SupliersService } from './supliers.service';
import { SupliersController } from './supliers.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SupliersController],
  providers: [SupliersService],
})
export class SupliersModule {}
