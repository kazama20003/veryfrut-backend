import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Area } from '@prisma/client';

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  // Método para crear una nueva área
  async create(createAreaDto: CreateAreaDto): Promise<Area> {
    const { name, companyId } = createAreaDto;

    const existingArea = await this.prisma.area.findFirst({
      where: {
        name,
        companyId,
      },
    });

    if (existingArea) {
      throw new ConflictException(
        'Area with this name already exists in the company',
      );
    }

    return this.prisma.area.create({
      data: {
        name,
        company: {
          connect: {
            id: companyId,
          },
        },
      },
      include: {
        company: true,
      },
    });
  }

  async findAll(): Promise<Area[]> {
    return this.prisma.area.findMany({
      include: {
        company: true,
      },
    });
  }

  async findOne(id: number): Promise<Area> {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });

    if (!area) {
      throw new NotFoundException(`Area with ID ${id} not found`);
    }

    return area;
  }

  async update(id: number, updateAreaDto: UpdateAreaDto): Promise<Area> {
    const { name, companyId } = updateAreaDto;

    const existingArea = await this.prisma.area.findUnique({
      where: { id },
    });

    if (!existingArea) {
      throw new NotFoundException(`Area with ID ${id} not found`);
    }

    return this.prisma.area.update({
      where: { id },
      data: {
        name,
        company: {
          connect: {
            id: companyId,
          },
        },
      },
      include: {
        company: true,
      },
    });
  }

  async remove(id: number): Promise<void> {
    const area = await this.prisma.area.findUnique({
      where: { id },
    });

    if (!area) {
      throw new NotFoundException(`Area with ID ${id} not found`);
    }

    await this.prisma.area.delete({
      where: { id },
    });
  }
}
