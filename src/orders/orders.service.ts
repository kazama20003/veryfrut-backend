import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CheckOrderDto } from './dto/check-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Order } from '@prisma/client';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { PaginationQueryDto } from 'src/common/pagination/pagination.dto';
import { PaginatedResponse } from 'src/common/pagination/paginated-response';
import { PaginationService } from 'src/common/pagination/pagination.service';
import { Prisma } from '@prisma/client';
// ✅ tipo con include (Order + relaciones)
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
    private prisma: PrismaService,
    private pagination: PaginationService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const { userId, areaId, totalAmount, status, observation, orderItems } =
      createOrderDto;

    return this.prisma.order.create({
      data: {
        userId,
        areaId,
        totalAmount,
        status,
        observation,
        orderItems: {
          create: orderItems.map((item) => ({
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

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<OrderWithRelations>> {
    const { page = 1, limit = 10, sortBy, order = 'desc', q } = query;

    const allowedSortFields = new Set([
      'id',
      'createdAt',
      'updatedAt',
      'totalAmount',
      'status',
      'userId',
      'areaId',
    ]);

    const safeSortBy =
      sortBy && allowedSortFields.has(sortBy) ? sortBy : 'createdAt';

    const orderBy = this.pagination.buildOrderBy(safeSortBy, order);

    const qAsNumber = q ? Number(q) : NaN;

    const where: Prisma.OrderWhereInput | undefined = q
      ? {
          OR: [
            ...(Number.isFinite(qAsNumber) ? [{ id: qAsNumber }] : []),
            { observation: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const include = {
      orderItems: {
        include: {
          product: true,
          unitMeasurement: true,
        },
      },
      User: true,
      area: true,
    } as const;

    const orderDelegate = {
      findMany: (args: Prisma.OrderFindManyArgs) =>
        this.prisma.order.findMany(args) as unknown as Promise<
          OrderWithRelations[]
        >,
      count: (args: Prisma.OrderCountArgs) => this.prisma.order.count(args),
    };

    const result = await this.pagination.paginate<
      OrderWithRelations,
      Prisma.OrderFindManyArgs,
      Prisma.OrderCountArgs
    >(orderDelegate, {
      page,
      limit,
      findManyArgs: {
        where,
        include,
        orderBy,
      },
      countArgs: { where },
    });

    return result;
  }

  async findOne(id: number): Promise<Order> {
    if (!id) throw new BadRequestException('El ID es obligatorio');

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: { include: { unitMeasurement: true } },
        User: true,
        area: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    return order;
  }

  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const { totalAmount, status, observation, orderItems } = updateOrderDto;

    const existingOrder = await this.prisma.order.findUnique({ where: { id } });
    if (!existingOrder) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    const peruTZ = 'America/Lima';

    const createdAtPeru = utcToZonedTime(existingOrder.createdAt, peruTZ);
    const nowPeru = utcToZonedTime(new Date(), peruTZ);

    const startOfDay = new Date(createdAtPeru);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);

    if (nowPeru < startOfDay || nowPeru >= endOfDay) {
      throw new BadRequestException(
        'La orden solo puede ser modificada durante el mismo día en que fue creada (horario de Perú).',
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        totalAmount,
        status,
        observation,
        orderItems: orderItems
          ? {
              deleteMany: {},
              create: orderItems.map((item) => ({
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

  async remove(id: number): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    await this.prisma.orderItem.deleteMany({ where: { orderId: id } });

    return this.prisma.order.delete({
      where: { id },
      include: {
        orderItems: true,
        User: true,
      },
    });
  }

  async findByUserId(userId: number): Promise<Order[]> {
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

  async checkExistingOrder(query: CheckOrderDto) {
    const { areaId, date } = query;

    if (!areaId) {
      throw new BadRequestException('El parámetro "areaId" es obligatorio.');
    }

    if (!date) {
      throw new BadRequestException('El parámetro "date" es obligatorio.');
    }

    const areaIdNum = Number(areaId);
    if (isNaN(areaIdNum)) {
      throw new BadRequestException(
        'El parámetro "areaId" debe ser un número.',
      );
    }

    // ✅ Validación segura para YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(
        'Fecha inválida. Formato esperado: YYYY-MM-DD',
      );
    }

    const tz = 'America/Lima';

    // ✅ Día completo en horario Perú → UTC
    const startUtc = zonedTimeToUtc(`${date} 00:00:00`, tz);
    const endUtc = zonedTimeToUtc(`${date} 23:59:59.999`, tz);

    console.log('🟡 Rango Lima → UTC:', {
      startUtc: startUtc.toISOString(),
      endUtc: endUtc.toISOString(),
    });

    const exists = await this.prisma.order.findFirst({
      where: {
        areaId: areaIdNum,
        createdAt: {
          gte: startUtc,
          lte: endUtc,
        },
      },
    });

    return { exists: Boolean(exists) };
  }

  async filterByDate(startDate: string, endDate: string): Promise<Order[]> {
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Los parámetros "startDate" y "endDate" son obligatorios.',
      );
    }

    // ✅ Validación formato YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new BadRequestException(
        'Las fechas deben tener el formato YYYY-MM-DD.',
      );
    }

    if (startDate > endDate) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior o igual a la fecha de fin.',
      );
    }

    const tz = 'America/Lima';

    // ✅ Rango completo Lima → UTC
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
      orderBy: { createdAt: 'desc' },
    });
  }
}
