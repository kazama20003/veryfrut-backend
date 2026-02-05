import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { SupliersService } from './supliers.service';
import { CreateSuplierDto } from './dto/create-suplier.dto';
import { UpdateSuplierDto } from './dto/update-suplier.dto';

@Controller('supliers')
export class SupliersController {
  constructor(private readonly supliersService: SupliersService) {}

  @Post()
  create(@Body() dto: CreateSuplierDto) {
    return this.supliersService.create(dto);
  }

  @Get()
  findAll() {
    return this.supliersService.findAll();
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
