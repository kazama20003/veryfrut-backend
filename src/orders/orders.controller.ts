import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CheckOrderDto } from './dto/check-order.dto';
import { PaginationQueryDto } from 'src/common/pagination/pagination.dto';
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.ordersService.findAll(query);
  }

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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(+id, updateOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(+id);
  }
}
