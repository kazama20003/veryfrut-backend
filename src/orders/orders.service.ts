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
import { formatInTimeZone, utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

// Reusable include para todas las queries — incluye category en product y company en area
const fullOrderInclude = {
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

/**
 * Order con todas sus relaciones (tipado automáticamente a partir de fullOrderInclude)
 */
type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof fullOrderInclude;
}>;

// ✅ Tipo de salida API: createdAt/updatedAt como string (Perú)
type OrderApi = Omit<OrderWithRelations, 'createdAt' | 'updatedAt'> & {
  createdAt: string; // Perú
  updatedAt: string; // Perú
};

@Injectable()
export class OrdersService {
  private readonly peruTz = 'America/Lima';

  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  // ✅ convierte Date UTC -> string Perú
  private toPeruDateTimeString(d: Date): string {
    // formato ISO-like sin Z (hora Perú)
    return formatInTimeZone(d, this.peruTz, "yyyy-MM-dd'T'HH:mm:ss");
  }

  // ✅ transforma una orden para que createdAt/updatedAt salgan en Perú
  private toApi(order: OrderWithRelations): OrderApi {
    const { createdAt, updatedAt, ...rest } = order;
    return {
      ...rest,
      createdAt: this.toPeruDateTimeString(createdAt),
      updatedAt: this.toPeruDateTimeString(updatedAt),
    };
  }

  private toApiMany(orders: OrderWithRelations[]): OrderApi[] {
    return orders.map((o) => this.toApi(o));
  }

  private normalizeToPeruDate(dateInput: string): string {
    const value = dateInput.trim();
    const plainDateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (plainDateRegex.test(value)) {
      return value;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        'Fecha invalida. Usa YYYY-MM-DD o una fecha ISO valida.',
      );
    }

    return formatInTimeZone(parsed, this.peruTz, 'yyyy-MM-dd');
  }

  private async existsOrderInPeruDate(
    areaId: number,
    peruDate: string,
  ): Promise<boolean> {
    const startUtc = zonedTimeToUtc(`${peruDate}T00:00:00`, this.peruTz);
    const endUtc = zonedTimeToUtc(`${peruDate}T23:59:59.999`, this.peruTz);

    const existingOrder = await this.prisma.order.findFirst({
      where: {
        areaId,
        createdAt: {
          gte: startUtc,
          lte: endUtc,
        },
      },
      select: { id: true },
    });

    return !!existingOrder;
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------
  async create(dto: CreateOrderDto): Promise<OrderApi> {
    const created = await this.prisma.order.create({
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
      include: fullOrderInclude,
    });

    return this.toApi(created);
  }

  // ---------------------------------------------------------------------------
  // FIND ALL (PAGINATED) -> data con fechas Perú
  // ---------------------------------------------------------------------------
  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<OrderApi>> {
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

    const delegate = {
      findMany: (args: Prisma.OrderFindManyArgs) =>
        this.prisma.order.findMany(args) as Promise<OrderWithRelations[]>,
      count: (args: Prisma.OrderCountArgs) => this.prisma.order.count(args),
    };

    const result = await this.pagination.paginate<
      OrderWithRelations,
      Prisma.OrderFindManyArgs,
      Prisma.OrderCountArgs
    >(delegate, {
      page,
      limit,
      findManyArgs: {
        where,
        include: fullOrderInclude,
        orderBy,
      },
      countArgs: { where },
    });

    return {
      ...result,
      data: this.toApiMany(result.data),
    };
  }

  // ---------------------------------------------------------------------------
  // FIND ONE -> fechas Perú
  // ---------------------------------------------------------------------------
  async findOne(id: number): Promise<OrderApi> {
    if (!id) {
      throw new BadRequestException('El ID es obligatorio');
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: fullOrderInclude,
    });

    if (!order) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    return this.toApi(order);
  }

  // ---------------------------------------------------------------------------
  // UPDATE (MISMO DÍA – HORA PERÚ) -> devuelve fechas Perú
  // ---------------------------------------------------------------------------
  async update(id: number, dto: UpdateOrderDto): Promise<OrderApi> {
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    const tz = this.peruTz;

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

    const updated = await this.prisma.order.update({
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
      include: fullOrderInclude,
    });

    return this.toApi(updated);
  }

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------
  async remove(id: number): Promise<void> {
    const exists = await this.prisma.order.findUnique({ where: { id } });

    if (!exists) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    await this.prisma.$transaction([
      this.prisma.orderItem.deleteMany({ where: { orderId: id } }),
      this.prisma.order.delete({ where: { id } }),
    ]);
  }

  // ---------------------------------------------------------------------------
  // CHECK EXISTING ORDER BY AREA + DATE (usa createdAt pero día Perú)
  // ---------------------------------------------------------------------------
  async checkExistingOrder(query: CheckOrderDto): Promise<{ exists: boolean }> {
    const { areaId, date } = query;
    const wrongAreaIdParam = (query as CheckOrderDto & { eaId?: string }).eaId;

    if (!areaId && wrongAreaIdParam) {
      throw new BadRequestException('Parametro invalido "eaId". Usa "areaId".');
    }

    if (!areaId)
      throw new BadRequestException('El parametro "areaId" es obligatorio.');
    if (!date)
      throw new BadRequestException('El parametro "date" es obligatorio.');

    const areaIdNum = Number(areaId);
    if (!Number.isInteger(areaIdNum) || areaIdNum <= 0) {
      throw new BadRequestException('El parametro "areaId" debe ser numerico.');
    }

    const peruDate = this.normalizeToPeruDate(date.trim());
    const exists = await this.existsOrderInPeruDate(areaIdNum, peruDate);
    return { exists };
  }

  // ---------------------------------------------------------------------------
  // FILTER BY DATE RANGE -> devuelve fechas Perú
  // ---------------------------------------------------------------------------
  async filterByDate(startDate: string, endDate: string): Promise<OrderApi[]> {
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

    const startUtc = zonedTimeToUtc(`${startDate}T00:00:00`, this.peruTz);
    const endUtc = zonedTimeToUtc(`${endDate}T23:59:59.999`, this.peruTz);

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: startUtc, lte: endUtc },
      },
      include: fullOrderInclude,
      orderBy: { createdAt: 'desc' },
    });

    return this.toApiMany(orders);
  }

  // ---------------------------------------------------------------------------
  // HISTORIAL POR USER -> devuelve fechas Perú
  // ---------------------------------------------------------------------------
  async findByUserId(userId: number): Promise<OrderApi[]> {
    if (!userId || userId <= 0) {
      throw new BadRequestException(
        'El userId es obligatorio y debe ser válido.',
      );
    }

    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: fullOrderInclude,
      orderBy: { createdAt: 'desc' },
    });

    return this.toApiMany(orders);
  }

  // ---------------------------------------------------------------------------
  // FIND ALL BY DAY (NO PAGINATION) -> devuelve fechas Perú
  // ---------------------------------------------------------------------------
  async findAllByDay(query: {
    date: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
    q?: string;
  }): Promise<OrderApi[]> {
    const { date, sortBy, order = 'desc', q } = query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(
        'El parámetro "date" es obligatorio y debe tener formato YYYY-MM-DD.',
      );
    }

    const startUtc = zonedTimeToUtc(`${date}T00:00:00`, this.peruTz);
    const endUtc = zonedTimeToUtc(`${date}T23:59:59.999`, this.peruTz);

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

    const orderBy: Prisma.OrderOrderByWithRelationInput = {
      [safeSortBy as keyof Prisma.OrderOrderByWithRelationInput]: order,
    };

    const qAsNumber = Number(q);

    const where: Prisma.OrderWhereInput = {
      createdAt: { gte: startUtc, lte: endUtc },
      ...(q && {
        OR: [
          ...(Number.isFinite(qAsNumber) ? [{ id: qAsNumber }] : []),
          {
            observation: {
              contains: q,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const orders = await this.prisma.order.findMany({
      where,
      include: fullOrderInclude,
      orderBy,
    });

    return this.toApiMany(orders);
  }
}
