import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { AuthModule } from 'src/auth/auth.module';
@Module({
  controllers: [OrdersController],
  providers: [OrdersService, JwtAuthGuard],
  imports: [PrismaModule, AuthModule],
})
export class OrdersModule {}
