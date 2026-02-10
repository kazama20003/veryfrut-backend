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
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PaginationQueryDto } from 'src/common/pagination/pagination.dto';
import { PaginatedResponse } from 'src/common/pagination/paginated-response';
import { Supplier, Purchase } from '@prisma/client';
import { UpdatePurchaseItemDto } from './dto/update-purchase-item.dto';
@Controller('supliers')
export class SupliersController {
  constructor(private readonly supliersService: SupliersService) {}

  // ==================== PROVEEDORES ====================

  @Post()
  create(@Body() dto: CreateSuplierDto): Promise<Supplier> {
    return this.supliersService.create(dto);
  }

  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Supplier>> {
    return this.supliersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Supplier> {
    return this.supliersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSuplierDto,
  ): Promise<Supplier> {
    return this.supliersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.supliersService.remove(id);
  }

  // ==================== COMPRAS ====================

  @Post(':id/purchases')
  createPurchase(
    @Param('id', ParseIntPipe) supplierId: number,
    @Body() dto: CreatePurchaseDto,
  ): Promise<Purchase> {
    return this.supliersService.createPurchase(supplierId, dto);
  }

  @Get(':id/purchases')
  findPurchasesBySupplier(
    @Param('id', ParseIntPipe) supplierId: number,
  ): Promise<Purchase[]> {
    return this.supliersService.findPurchasesBySupplier(supplierId);
  }

  @Get('purchases/:purchaseId')
  findPurchaseById(
    @Param('purchaseId', ParseIntPipe) purchaseId: number,
  ): Promise<Purchase> {
    return this.supliersService.findPurchaseById(purchaseId);
  }

  @Patch('purchases/items/:itemId')
  updatePurchaseItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdatePurchaseItemDto,
  ) {
    return this.supliersService.updatePurchaseItem(itemId, dto);
  }

  @Patch('purchases/:purchaseId')
  updatePurchase(
    @Param('purchaseId', ParseIntPipe) purchaseId: number,
    @Body() dto: UpdatePurchaseDto,
  ): Promise<Purchase> {
    return this.supliersService.updatePurchase(purchaseId, dto);
  }

  @Delete('purchases/:purchaseId')
  removePurchase(
    @Param('purchaseId', ParseIntPipe) purchaseId: number,
  ): Promise<{ message: string }> {
    return this.supliersService.removePurchase(purchaseId);
  }
  @Delete('purchases/items/:itemId')
  removePurchaseItem(@Param('itemId', ParseIntPipe) itemId: number) {
    return this.supliersService.removePurchaseItem(itemId);
  }
}
