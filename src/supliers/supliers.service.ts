import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSuplierDto } from './dto/create-suplier.dto';
import { UpdateSuplierDto } from './dto/update-suplier.dto';

@Injectable()
export class SupliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSuplierDto) {
    return await this.prisma.supplier.create({
      data: {
        name: dto.name,
        companyName: dto.companyName,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
      },
    });
  }

  async findAll() {
    return await this.prisma.supplier.findMany({
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

    return await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        companyName: dto.companyName,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return await this.prisma.supplier.delete({
      where: { id },
    });
  }
}
