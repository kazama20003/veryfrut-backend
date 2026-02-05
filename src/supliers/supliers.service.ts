import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSuplierDto } from './dto/create-suplier.dto';
import { UpdateSuplierDto } from './dto/update-suplier.dto';

@Injectable()
export class SupliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSuplierDto) {
    return this.prisma.supplier.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.supplier.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier ${id} no existe`);
    }

    return supplier;
  }

  async update(id: number, dto: UpdateSuplierDto) {
    await this.findOne(id); // valida existencia

    return this.prisma.supplier.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.supplier.delete({
      where: { id },
    });
  }
}
