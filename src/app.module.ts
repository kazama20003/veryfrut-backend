import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { UnitMeasurementModule } from './unit-measurement/unit-measurement.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AreasModule } from './areas/areas.module';
import { CompanyModule } from './company/company.module';
import { UploadsModule } from './uploads/uploads.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PaginationModule } from './common/pagination/pagination.module';

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    UnitMeasurementModule,
    PaginationModule,
    UsersModule,
    AuthModule,
    AreasModule,
    CompanyModule,
    UploadsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
