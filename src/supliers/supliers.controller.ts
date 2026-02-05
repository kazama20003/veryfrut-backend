import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { SupliersService } from './supliers.service';
import { CreateSuplierDto } from './dto/create-suplier.dto';
import { UpdateSuplierDto } from './dto/update-suplier.dto';
import { PaginationQueryDto } from 'src/common/pagination/pagination.dto';
import { PaginatedResponse } from 'src/common/pagination/paginated-response';
import { Supplier } from '@prisma/client';

@Controller('supliers')
export class SupliersController {
  constructor(private readonly supliersService: SupliersService) {}

  @Post()
  create(@Body() dto: CreateSuplierDto) {
    return this.supliersService.create(dto);
  }

  @Get()
  findAll(
    @Query() query: PaginationQueryDto, // <-- recibimos page, limit, sortBy, order
  ): Promise<PaginatedResponse<Supplier>> {
    return this.supliersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.supliersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSuplierDto) {
    return this.supliersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.supliersService.remove(id);
  }
}
