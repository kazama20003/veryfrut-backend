// src/supliers/supliers.service.ts
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationService } from 'src/common/pagination/pagination.service';
import { CreateSuplierDto } from './dto/create-suplier.dto';
import { UpdateSuplierDto } from './dto/update-suplier.dto';
import { Supplier } from '@prisma/client';
import { PaginationQueryDto } from 'src/common/pagination/pagination.dto';
import { PaginatedResponse } from 'src/common/pagination/paginated-response';

@Injectable()
export class SupliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
  ) {}

  async create(dto: CreateSuplierDto): Promise<Supplier> {
    try {
      return await this.prisma.supplier.create({ data: dto });
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw new InternalServerErrorException('Error al crear el proveedor');
    }
  }

  // --- Find all con paginación ---
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
                    unitMeasurement: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                    product: {
                      select: {
                        id: true,
                        name: true,
                        // NO incluimos price
                        category: {
                          select: {
                            id: true,
                            name: true,
                          },
                        },
                        imageUrl: true, // opcional, si quieres mostrar imagen
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
          },
        },
      });

      if (!supplier) {
        throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);
      }

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
      const supplierExists = await this.prisma.supplier.findUnique({
        where: { id },
      });

      if (!supplierExists) {
        throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);
      }

      return await this.prisma.supplier.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      console.error('Error updating supplier:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al actualizar el proveedor');
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    try {
      const supplierExists = await this.prisma.supplier.findUnique({
        where: { id },
      });

      if (!supplierExists) {
        throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);
      }

      await this.prisma.supplier.delete({ where: { id } });

      return { message: `Proveedor con ID ${id} eliminado correctamente` };
    } catch (error) {
      console.error('Error deleting supplier:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al eliminar el proveedor');
    }
  }
}
