// src/products/products.service.ts
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

import { PaginationService } from 'src/common/pagination/pagination.service';

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// ✅ Tipo de retorno cuando incluimos relaciones
type ProductWithUnits = Prisma.ProductGetPayload<{
  include: {
    productUnits: {
      include: { unitMeasurement: true };
    };
  };
}>;

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private pagination: PaginationService,
  ) {}

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
              (unitMeasurementId) => ({ unitMeasurementId }),
            ),
          },
        },
        include: {
          productUnits: true,
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

  // ✅ PAGINADO + SORT + SEARCH
  async findAll(q?: string): Promise<ProductWithUnits[]> {
    const where: Prisma.ProductWhereInput | undefined = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined;

    return this.prisma.product.findMany({
      where,
      include: {
        productUnits: {
          include: {
            unitMeasurement: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number): Promise<ProductWithUnits> {
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
  ): Promise<ProductWithUnits> {
    try {
      const { unitMeasurementIds, ...rest } = updateProductDto;

      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...rest,
          productUnits: unitMeasurementIds
            ? {
                deleteMany: {},
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
      if (error instanceof NotFoundException) throw error;

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
      await this.prisma.productUnitMeasurement.deleteMany({
        where: { productId: id },
      });

      const product = await this.prisma.product.delete({
        where: { id },
      });

      return product;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      if (isError(error)) {
        throw new InternalServerErrorException(
          'Error deleting product: ' + error.message,
        );
      }
      throw new InternalServerErrorException('Unknown error deleting product');
    }
  }
}
