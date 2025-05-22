import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Product } from '@prisma/client';

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    try {
      const product = await this.prisma.product.create({
        data: {
          name: createProductDto.name,
          description: createProductDto.description,
          price: createProductDto.price,
          stock: createProductDto.stock,
          imageUrl: createProductDto.imageUrl,
          categoryId: createProductDto.categoryId,
          productUnits: {
            create: createProductDto.unitMeasurementIds.map(
              (unitMeasurementId) => ({
                unitMeasurementId,
              }),
            ),
          },
        },
        include: {
          productUnits: true, // opcional, si quieres retornar las unidades relacionadas
        },
      });
      return product;
    } catch (error: unknown) {
      if (isError(error)) {
        throw new InternalServerErrorException(
          'Error creating product: ' + error.message,
        );
      }
      throw new InternalServerErrorException('Unknown error creating product');
    }
  }

  async findAll(): Promise<Product[]> {
    try {
      const products = await this.prisma.product.findMany({
        include: {
          productUnits: {
            include: {
              unitMeasurement: true, // Incluye las unidades de medida relacionadas
            },
          },
        },
      });

      if (!products || products.length === 0) {
        throw new NotFoundException('No products found in the database.');
      }

      return products;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2021'
      ) {
        throw new NotFoundException(
          'Product table does not exist in the database',
        );
      }
      throw error; // Re-lanzamos otros errores inesperados
    }
  }

  async findOne(id: number): Promise<Product> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: {
          productUnits: {
            include: {
              unitMeasurement: true,
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with id ${id} not found`);
      }

      return product;
    } catch (error: unknown) {
      if (isError(error)) {
        throw new InternalServerErrorException(
          'Error fetching product: ' + error.message,
        );
      }
      throw new InternalServerErrorException('Unknown error fetching product');
    }
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    try {
      const { unitMeasurementIds, ...rest } = updateProductDto;

      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...rest,
          productUnits: unitMeasurementIds
            ? {
                deleteMany: {}, // Elimina las relaciones existentes
                create: unitMeasurementIds.map((unitMeasurementId) => ({
                  unitMeasurementId,
                })),
              }
            : undefined,
        },
        include: {
          productUnits: {
            include: {
              unitMeasurement: true,
            },
          },
        },
      });

      return product;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (isError(error)) {
        throw new InternalServerErrorException(
          'Error updating product: ' + error.message,
        );
      }
      throw new InternalServerErrorException('Unknown error updating product');
    }
  }

  async remove(id: number): Promise<Product> {
    try {
      // Elimina relaciones en la tabla intermedia
      await this.prisma.productUnitMeasurement.deleteMany({
        where: { productId: id },
      });

      // Elimina el producto una vez eliminadas las relaciones
      const product = await this.prisma.product.delete({
        where: { id },
      });

      return product;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (isError(error)) {
        throw new InternalServerErrorException(
          'Error deleting product: ' + error.message,
        );
      }
      throw new InternalServerErrorException('Unknown error deleting product');
    }
  }
}
