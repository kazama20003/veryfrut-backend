import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationService } from 'src/common/pagination/pagination.service';
import { PaginationQueryDto } from 'src/common/pagination/pagination.dto';
import { PaginatedResponse } from 'src/common/pagination/paginated-response';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CheckOrderDto } from './dto/check-order.dto';
import { Prisma } from '@prisma/client';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

/**
 * Order con todas sus relaciones
 */
type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    orderItems: {
      include: {
        product: true;
        unitMeasurement: true;
      };
    };
    User: true;
    area: true;
  };
}>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  // ---------------------------------------------------------------------------
  // CREATE ORDER
  // ---------------------------------------------------------------------------
  async create(dto: CreateOrderDto): Promise<OrderWithRelations> {
    return this.prisma.order.create({
      data: {
        userId: dto.userId,
        areaId: dto.areaId,
        totalAmount: dto.totalAmount,
        status: dto.status,
        observation: dto.observation,
        orderItems: {
          create: dto.orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            unitMeasurementId: item.unitMeasurementId,
          })),
        },
      },
      include: {
        orderItems: {
          include: {
            product: true,
            unitMeasurement: true,
          },
        },
        User: true,
        area: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // FIND ALL (PAGINATED)
  // ---------------------------------------------------------------------------
  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<OrderWithRelations>> {
    const { page = 1, limit = 10, sortBy, order = 'desc', q } = query;

    const allowedSortFields = new Set<
      keyof Prisma.OrderOrderByWithRelationInput
    >([
      'id',
      'createdAt',
      'updatedAt',
      'totalAmount',
      'status',
      'userId',
      'areaId',
    ]);

    const safeSortBy = allowedSortFields.has(
      sortBy as keyof Prisma.OrderOrderByWithRelationInput,
    )
      ? sortBy
      : 'createdAt';

    const orderBy = this.pagination.buildOrderBy(safeSortBy, order);

    const qAsNumber = Number(q);

    const where: Prisma.OrderWhereInput | undefined = q
      ? {
          OR: [
            ...(Number.isFinite(qAsNumber) ? [{ id: qAsNumber }] : []),
            {
              observation: {
                contains: q,
                mode: 'insensitive',
              },
            },
          ],
        }
      : undefined;

    const orderInclude = {
      orderItems: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
          unitMeasurement: true,
        },
      },
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          role: true,
        },
      },
      area: {
        include: {
          company: true,
        },
      },
    } as const;

    const delegate = {
      findMany: (args: Prisma.OrderFindManyArgs) =>
        this.prisma.order.findMany(args) as Promise<OrderWithRelations[]>,
      count: (args: Prisma.OrderCountArgs) => this.prisma.order.count(args),
    };

    return this.pagination.paginate<
      OrderWithRelations,
      Prisma.OrderFindManyArgs,
      Prisma.OrderCountArgs
    >(delegate, {
      page,
      limit,
      findManyArgs: {
        where,
        include: orderInclude, // ✅ AQUÍ estaba el error
        orderBy,
      },
      countArgs: { where },
    });
  }

  // ---------------------------------------------------------------------------
  // FIND ONE
  // ---------------------------------------------------------------------------
  async findOne(id: number): Promise<OrderWithRelations> {
    if (!id) {
      throw new BadRequestException('El ID es obligatorio');
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: true,
            unitMeasurement: true,
          },
        },
        User: true,
        area: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    return order;
  }

  // ---------------------------------------------------------------------------
  // UPDATE (MISMO DÍA – HORA PERÚ)
  // ---------------------------------------------------------------------------
  async update(id: number, dto: UpdateOrderDto): Promise<OrderWithRelations> {
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    const tz = 'America/Lima';

    const createdAtPeru = utcToZonedTime(existingOrder.createdAt, tz);
    const nowPeru = utcToZonedTime(new Date(), tz);

    const startOfDay = new Date(createdAtPeru);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);

    if (nowPeru < startOfDay || nowPeru >= endOfDay) {
      throw new BadRequestException(
        'La orden solo puede modificarse el mismo día de su creación (hora Perú).',
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        totalAmount: dto.totalAmount,
        status: dto.status,
        observation: dto.observation,
        orderItems: dto.orderItems
          ? {
              deleteMany: {},
              create: dto.orderItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                unitMeasurementId: item.unitMeasurementId,
              })),
            }
          : undefined,
      },
      include: {
        orderItems: {
          include: {
            product: true,
            unitMeasurement: true,
          },
        },
        User: true,
        area: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------
  async remove(id: number): Promise<void> {
    const exists = await this.prisma.order.findUnique({ where: { id } });

    if (!exists) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    await this.prisma.orderItem.deleteMany({
      where: { orderId: id },
    });

    await this.prisma.order.delete({
      where: { id },
    });
  }

  // ---------------------------------------------------------------------------
  // CHECK EXISTING ORDER BY AREA + DATE
  // ---------------------------------------------------------------------------
  async checkExistingOrder(query: CheckOrderDto) {
    const { areaId, date } = query;

    if (!areaId) {
      throw new BadRequestException('El parámetro "areaId" es obligatorio.');
    }

    if (!date) {
      throw new BadRequestException('El parámetro "date" es obligatorio.');
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(
        'Fecha inválida. Formato esperado: YYYY-MM-DD',
      );
    }

    const tz = 'America/Lima';

    const startUtc = zonedTimeToUtc(`${date} 00:00:00`, tz);
    const endUtc = zonedTimeToUtc(`${date} 23:59:59.999`, tz);

    const exists = await this.prisma.order.findFirst({
      where: {
        areaId: Number(areaId),
        createdAt: {
          gte: startUtc,
          lte: endUtc,
        },
      },
    });

    return { exists: Boolean(exists) };
  }

  // ---------------------------------------------------------------------------
  // FILTER BY DATE RANGE
  // ---------------------------------------------------------------------------
  async filterByDate(
    startDate: string,
    endDate: string,
  ): Promise<OrderWithRelations[]> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new BadRequestException(
        'Las fechas deben tener el formato YYYY-MM-DD.',
      );
    }

    if (startDate > endDate) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser mayor que la fecha de fin.',
      );
    }

    const tz = 'America/Lima';

    const startUtc = zonedTimeToUtc(`${startDate} 00:00:00`, tz);
    const endUtc = zonedTimeToUtc(`${endDate} 23:59:59.999`, tz);

    return this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: startUtc,
          lte: endUtc,
        },
      },
      include: {
        orderItems: {
          include: {
            product: true,
            unitMeasurement: true,
          },
        },
        User: true,
        area: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByUserId(userId: number): Promise<OrderWithRelations[]> {
    return this.prisma.order.findMany({
      where: {
        userId,
      },
      include: {
        orderItems: {
          include: {
            product: true,
            unitMeasurement: true,
          },
        },
        User: true,
        area: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
