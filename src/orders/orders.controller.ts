import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CheckOrderDto } from './dto/check-order.dto';
import { PaginationQueryDto } from 'src/common/pagination/pagination.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: number | string;
    id?: number | string;
    email?: string;
    role?: string;
  };
};

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createOrderDto: CreateOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.create(createOrderDto, req.user?.role);
  }

  @Get('follow-up')
  @UseGuards(JwtAuthGuard)
  followUp(@Query('date') date: string, @Req() req: AuthenticatedRequest) {
    return this.ordersService.followUp(date, req.user?.role);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.ordersService.findAll(query);
  }

  // 🔹 Rutas fijas primero
  @Get('by-day')
  findAllByDay(
    @Query()
    query: {
      date: string;
      sortBy?: string;
      order?: 'asc' | 'desc';
      q?: string;
    },
  ) {
    return this.ordersService.findAllByDay(query);
  }

  @Get('check')
  async checkExistingOrder(@Query() query: CheckOrderDto) {
    return this.ordersService.checkExistingOrder(query);
  }

  @Get('customer/:customerId')
  findByUserId(@Param('customerId') customerId: string) {
    return this.ordersService.findByUserId(+customerId);
  }

  @Get('filter')
  async filterOrdersByDate(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.ordersService.filterByDate(startDate, endDate);
  }

  // 🔹 Ruta dinámica al final
  @Get('deleted')
  findDeleted(@Query() query: PaginationQueryDto) {
    return this.ordersService.findDeleted(query);
  }

  @Get('deleted/:id')
  findDeletedOne(@Param('id') id: string) {
    return this.ordersService.findDeletedOne(+id);
  }

  @Post('deleted/:id/restore')
  restoreDeleted(@Param('id') id: string) {
    return this.ordersService.restoreDeleted(+id);
  }

  @Delete('deleted/:id')
  removeDeleted(@Param('id') id: string): Promise<{ message: string }> {
    return this.ordersService.removeDeleted(+id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(+id, updateOrderDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.ordersService.remove(+id, req.user?.role);
  }
}
