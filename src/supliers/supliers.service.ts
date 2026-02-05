import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSuplierDto } from './dto/create-suplier.dto';
import { UpdateSuplierDto } from './dto/update-suplier.dto';
import { Supplier } from '@prisma/client';

@Injectable()
export class SupliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSuplierDto): Promise<Supplier> {
    try {
      return await this.prisma.supplier.create({
        data: dto,
      });
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw new InternalServerErrorException('Error al crear el proveedor');
    }
  }

  async findAll(): Promise<Supplier[]> {
    try {
      const suppliers = await this.prisma.supplier.findMany({
        orderBy: { createdAt: 'desc' },
      });

      if (!suppliers || suppliers.length === 0) {
        throw new NotFoundException('No existen proveedores registrados');
      }

      return suppliers;
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al obtener los proveedores');
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

      await this.prisma.supplier.delete({
        where: { id },
      });

      return {
        message: `Proveedor con ID ${id} eliminado correctamente`,
      };
    } catch (error) {
      console.error('Error deleting supplier:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al eliminar el proveedor');
    }
  }
}
