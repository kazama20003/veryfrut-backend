import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Category } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // Crear una categoría
  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    try {
      const category = await this.prisma.category.create({
        data: createCategoryDto,
      });
      return category;
    } catch (error: unknown) {
      // Uso de 'unknown' para asegurar un manejo seguro del error
      if (error instanceof Error) {
        throw new Error(`Error creating category: ${error.message}`);
      } else {
        throw new Error(
          'An unknown error occurred while creating the category.',
        );
      }
    }
  }

  // Obtener todas las categorías
  async findAll(): Promise<Category[]> {
    try {
      return await this.prisma.category.findMany();
    } catch (error: unknown) {
      // Uso de 'unknown' para asegurar un manejo seguro del error
      if (error instanceof Error) {
        throw new Error(`Error fetching categories: ${error.message}`);
      } else {
        throw new Error('An unknown error occurred while fetching categories.');
      }
    }
  }

  // Obtener una categoría por ID
  async findOne(id: number): Promise<Category | null> {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
      });
      if (!category) {
        throw new Error(`Category with ID ${id} not found`);
      }
      return category;
    } catch (error: unknown) {
      // Uso de 'unknown' para asegurar un manejo seguro del error
      if (error instanceof Error) {
        throw new Error(
          `Error fetching category with ID ${id}: ${error.message}`,
        );
      } else {
        throw new Error(
          'An unknown error occurred while fetching the category.',
        );
      }
    }
  }

  // Actualizar una categoría
  async update(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: updateCategoryDto,
      });
      if (!category) {
        throw new Error(`Category with ID ${id} not found`);
      }
      return category;
    } catch (error: unknown) {
      // Uso de 'unknown' para asegurar un manejo seguro del error
      if (error instanceof Error) {
        throw new Error(
          `Error updating category with ID ${id}: ${error.message}`,
        );
      } else {
        throw new Error(
          'An unknown error occurred while updating the category.',
        );
      }
    }
  }

  // Eliminar una categoría
  async remove(id: number): Promise<Category> {
    try {
      const category = await this.prisma.category.delete({
        where: { id },
      });
      if (!category) {
        throw new Error(`Category with ID ${id} not found`);
      }
      return category;
    } catch (error: unknown) {
      // Uso de 'unknown' para asegurar un manejo seguro del error
      if (error instanceof Error) {
        throw new Error(
          `Error deleting category with ID ${id}: ${error.message}`,
        );
      } else {
        throw new Error(
          'An unknown error occurred while deleting the category.',
        );
      }
    }
  }
}
