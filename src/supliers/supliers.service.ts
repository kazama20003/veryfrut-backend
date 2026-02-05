import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationService } from 'src/common/pagination/pagination.service';
import { CreateSuplierDto } from './dto/create-suplier.dto';
import { UpdateSuplierDto } from './dto/update-suplier.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { Supplier, Purchase } from '@prisma/client';
import { PaginationQueryDto } from 'src/common/pagination/pagination.dto';
import { PaginatedResponse } from 'src/common/pagination/paginated-response';

@Injectable()
export class SupliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
  ) {}

  // ==================== PROVEEDORES ====================

  async create(dto: CreateSuplierDto): Promise<Supplier> {
    try {
      return await this.prisma.supplier.create({ data: dto });
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw new InternalServerErrorException('Error al crear el proveedor');
    }
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Supplier>> {
    try {
      const { page = 1, limit = 10, sortBy, order = 'desc' } = query;
      const orderBy = this.paginationService.buildOrderBy(sortBy, order);

      return this.paginationService.paginate(this.prisma.supplier, {
        page,
        limit,
        findManyArgs: {
          orderBy: orderBy || { createdAt: 'desc' },
          include: {
            purchases: {
              orderBy: { createdAt: 'desc' },
              include: {
                purchaseItems: {
                  select: {
                    id: true,
                    productId: true,
                    quantity: true,
                    unitCost: true,
                    totalCost: true,
                    unitMeasurement: { select: { id: true, name: true } },
                    product: {
                      select: {
                        id: true,
                        name: true,
                        category: { select: { id: true, name: true } },
                        imageUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        countArgs: {},
      });
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw new InternalServerErrorException(
        'Error al obtener los proveedores',
      );
    }
  }

  async findOne(id: number): Promise<Supplier> {
    try {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
        include: {
          purchases: {
            orderBy: { createdAt: 'desc' },
            include: {
              purchaseItems: {
                select: {
                  id: true,
                  productId: true,
                  quantity: true,
                  unitCost: true,
                  totalCost: true,
                  unitMeasurement: { select: { id: true, name: true } },
                  product: {
                    select: {
                      id: true,
                      name: true,
                      category: { select: { id: true, name: true } },
                      imageUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!supplier)
        throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);
      return supplier;
    } catch (error) {
      console.error('Error finding supplier:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al buscar el proveedor');
    }
  }

  async update(id: number, dto: UpdateSuplierDto): Promise<Supplier> {
    try {
      const exists = await this.prisma.supplier.findUnique({ where: { id } });
      if (!exists)
        throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);

      return await this.prisma.supplier.update({ where: { id }, data: dto });
    } catch (error) {
      console.error('Error updating supplier:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al actualizar el proveedor');
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    try {
      const exists = await this.prisma.supplier.findUnique({ where: { id } });
      if (!exists)
        throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);

      await this.prisma.supplier.delete({ where: { id } });
      return { message: `Proveedor con ID ${id} eliminado correctamente` };
    } catch (error) {
      console.error('Error deleting supplier:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al eliminar el proveedor');
    }
  }

  // ==================== COMPRAS ====================

  async createPurchase(
    supplierId: number,
    dto: CreatePurchaseDto,
  ): Promise<Purchase> {
    try {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: supplierId },
      });
      if (!supplier)
        throw new NotFoundException(
          `Proveedor con ID ${supplierId} no encontrado`,
        );

      const itemsData = dto.purchaseItems.map((item) => ({
        ...item,
        totalCost: item.unitCost * item.quantity,
      }));

      return await this.prisma.purchase.create({
        data: {
          supplierId,
          areaId: dto.areaId ?? undefined,
          totalAmount: dto.totalAmount,
          status: 'created',
          paid: false,
          purchaseItems: { create: itemsData },
        },
        include: {
          purchaseItems: {
            select: {
              id: true,
              productId: true,
              description: true,
              quantity: true,
              unitCost: true,
              totalCost: true,
              unitMeasurement: { select: { id: true, name: true } },
              product: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { id: true, name: true } },
                  imageUrl: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error('Error creating purchase:', error);
      throw new InternalServerErrorException('Error al crear la compra');
    }
  }

  async findPurchasesBySupplier(supplierId: number): Promise<Purchase[]> {
    try {
      return await this.prisma.purchase.findMany({
        where: { supplierId },
        orderBy: { createdAt: 'desc' },
        include: {
          purchaseItems: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              unitCost: true,
              totalCost: true,
              unitMeasurement: { select: { id: true, name: true } },
              product: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { id: true, name: true } },
                  imageUrl: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error('Error fetching purchases:', error);
      throw new InternalServerErrorException('Error al obtener las compras');
    }
  }

  async findPurchaseById(purchaseId: number): Promise<Purchase> {
    try {
      const purchase = await this.prisma.purchase.findUnique({
        where: { id: purchaseId },
        include: {
          purchaseItems: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              unitCost: true,
              totalCost: true,
              unitMeasurement: { select: { id: true, name: true } },
              product: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { id: true, name: true } },
                  imageUrl: true,
                },
              },
            },
          },
        },
      });

      if (!purchase)
        throw new NotFoundException(
          `Compra con ID ${purchaseId} no encontrada`,
        );
      return purchase;
    } catch (error) {
      console.error('Error fetching purchase:', error);
      throw new InternalServerErrorException('Error al obtener la compra');
    }
  }

  async updatePurchase(
    purchaseId: number,
    dto: UpdatePurchaseDto,
  ): Promise<Purchase> {
    try {
      const exists = await this.prisma.purchase.findUnique({
        where: { id: purchaseId },
      });
      if (!exists)
        throw new NotFoundException(
          `Compra con ID ${purchaseId} no encontrada`,
        );

      return await this.prisma.purchase.update({
        where: { id: purchaseId },
        data: dto,
      });
    } catch (error) {
      console.error('Error updating purchase:', error);
      throw new InternalServerErrorException('Error al actualizar la compra');
    }
  }

  async removePurchase(purchaseId: number): Promise<{ message: string }> {
    try {
      const exists = await this.prisma.purchase.findUnique({
        where: { id: purchaseId },
      });
      if (!exists)
        throw new NotFoundException(
          `Compra con ID ${purchaseId} no encontrada`,
        );

      await this.prisma.purchase.delete({ where: { id: purchaseId } });
      return { message: `Compra con ID ${purchaseId} eliminada correctamente` };
    } catch (error) {
      console.error('Error deleting purchase:', error);
      throw new InternalServerErrorException('Error al eliminar la compra');
    }
  }
}
