import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Company } from '@prisma/client';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  // Crear una nueva empresa
  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    try {
      return await this.prisma.company.create({
        data: createCompanyDto,
      });
    } catch (error) {
      console.error('Error creating company:', error);
      throw new InternalServerErrorException('Error al crear la empresa');
    }
  }

  // Obtener todas las empresas
  async findAll(): Promise<Company[]> {
    try {
      return await this.prisma.company.findMany({
        include: {
          areas: true, // Incluimos las áreas relacionadas
        },
      });
    } catch (error) {
      console.error('Error retrieving companies:', error);
      throw new InternalServerErrorException('Error al obtener las empresas');
    }
  }

  // Obtener una empresa por ID
  async findOne(id: number): Promise<Company> {
    try {
      const company = await this.prisma.company.findUnique({
        where: { id },
        include: {
          areas: true, // Incluimos las áreas relacionadas
        },
      });

      if (!company) {
        throw new NotFoundException(`Empresa con ID ${id} no encontrada`);
      }

      return company;
    } catch (error) {
      console.error('Error finding company:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al buscar la empresa');
    }
  }

  // Actualizar una empresa por ID
  async update(
    id: number,
    updateCompanyDto: UpdateCompanyDto,
  ): Promise<Company> {
    try {
      // Verificamos que la empresa exista antes de actualizar
      const companyExists = await this.prisma.company.findUnique({
        where: { id },
      });

      if (!companyExists) {
        throw new NotFoundException(`Empresa con ID ${id} no encontrada`);
      }

      return await this.prisma.company.update({
        where: { id },
        data: updateCompanyDto,
      });
    } catch (error) {
      console.error('Error updating company:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al actualizar la empresa');
    }
  }

  // Eliminar una empresa por ID
  async remove(id: number): Promise<{ message: string }> {
    try {
      // Verificamos que la empresa exista antes de eliminar
      const companyExists = await this.prisma.company.findUnique({
        where: { id },
      });

      if (!companyExists) {
        throw new NotFoundException(`Empresa con ID ${id} no encontrada`);
      }

      await this.prisma.company.delete({
        where: { id },
      });

      return { message: `Empresa con ID ${id} eliminada correctamente` };
    } catch (error) {
      console.error('Error deleting company:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al eliminar la empresa');
    }
  }
}
