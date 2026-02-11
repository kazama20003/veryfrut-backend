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
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';

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

type PeruDateFields = {
  createdAtPeruDate: string; // yyyy-MM-dd
  createdAtPeruTime: string; // HH:mm:ss
  createdAtPeru: string; // yyyy-MM-dd HH:mm:ss
  updatedAtPeru?: string; // yyyy-MM-dd HH:mm:ss
};

type OrderWithPeru = OrderWithRelations & PeruDateFields;

type WithItems<T> = { items: T[] };
type WithData<T> = { data: T[] };

@Injectable()
export class OrdersService {
  private readonly peruTz = 'America/Lima';

  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private normalizeToPeruDate(dateInput: string): string {
    const value = dateInput.trim();
    const plainDateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (plainDateRegex.test(value)) return value;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        'Fecha invalida. Usa YYYY-MM-DD o una fecha ISO valida.',
      );
    }

    return formatInTimeZone(parsed, this.peruTz, 'yyyy-MM-dd');
  }

  private getPeruDayRangeUtc(peruDate: string): {
    startUtc: Date;
    nextDayUtc: Date;
  } {
    // rango: [00:00 Perú, 00:00 del día siguiente Perú)
    const startUtc = zonedTimeToUtc(`${peruDate}T00:00:00.000`, this.peruTz);
    const nextDayUtc = new Date(startUtc);
    nextDayUtc.setUTCDate(nextDayUtc.getUTCDate() + 1);
    return { startUtc, nextDayUtc };
  }

  private addPeruFields(order: OrderWithRelations): OrderWithPeru {
    // ✅ sin type assertion innecesaria (arregla no-unnecessary-type-assertion)
    const createdAtPeruDate = formatInTimeZone(
      order.createdAt,
      this.peruTz,
      'yyyy-MM-dd',
    );
    const createdAtPeruTime = formatInTimeZone(
      order.createdAt,
      this.peruTz,
      'HH:mm:ss',
    );
    const createdAtPeru = formatInTimeZone(
      order.createdAt,
      this.peruTz,
      'yyyy-MM-dd HH:mm:ss',
    );

    const base: OrderWithPeru = {
      ...order,
      createdAtPeruDate,
      createdAtPeruTime,
      createdAtPeru,
    };

    if (order.updatedAt) {
      base.updatedAtPeru = formatInTimeZone(
        order.updatedAt,
        this.peruTz,
        'yyyy-MM-dd HH:mm:ss',
      );
    }

    return base;
  }

  // ✅ Type-guards sin any (arregla no-unsafe-*)
  private hasItems<T>(
    res: unknown,
  ): res is PaginatedResponse<T> & WithItems<T> {
    if (typeof res !== 'object' || res === null) return false;
    const r = res as Record<string, unknown>;
    return Array.isArray(r.items);
  }

  private hasData<T>(res: unknown): res is PaginatedResponse<T> & WithData<T> {
    if (typeof res !== 'object' || res === null) return false;
    const r = res as Record<string, unknown>;
    return Array.isArray(r.data);
  }

  private mapPaginatedOrders(
    res: PaginatedResponse<OrderWithRelations>,
  ): PaginatedResponse<OrderWithPeru> {
    // Si tu PaginatedResponse trae "items"
    if (this.hasItems<OrderWithRelations>(res)) {
      const mappedItems = res.items.map((o) => this.addPeruFields(o));

      // Mantén el resto de propiedades igual, solo reemplaza items
      const base = res;
      return {
        ...(base as unknown as Omit<PaginatedResponse<OrderWithPeru>, 'items'>),
        items: mappedItems,
      } as PaginatedResponse<OrderWithPeru>;
    }

    // Si tu PaginatedResponse trae "data"
    if (this.hasData<OrderWithRelations>(res)) {
      const mappedData = res.data.map((o) => this.addPeruFields(o));

      const base = res;
      return {
        ...(base as unknown as Omit<PaginatedResponse<OrderWithPeru>, 'data'>),
        data: mappedData,
      } as PaginatedResponse<OrderWithPeru>;
    }

    // Si tu PaginatedResponse usa otro nombre, devolvemos tal cual pero casteado
    return res as unknown as PaginatedResponse<OrderWithPeru>;
  }

  private async existsOrderInPeruDate(
    areaId: number,
    peruDate: string,
  ): Promise<boolean> {
    const { startUtc, nextDayUtc } = this.getPeruDayRangeUtc(peruDate);

    const existingOrder = await this.prisma.order.findFirst({
      where: {
        areaId,
        createdAt: {
          gte: startUtc,
          lt: nextDayUtc, // ✅ fin exclusivo
        },
      },
      select: { id: true },
    });

    return !!existingOrder;
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------
  async create(dto: CreateOrderDto): Promise<OrderWithPeru> {
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

    return this.addPeruFields(created);
  }

  // ---------------------------------------------------------------------------
  // FIND ALL (PAGINATED)
  // ---------------------------------------------------------------------------
  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<OrderWithPeru>> {
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

    return this.mapPaginatedOrders(result);
  }

  // ---------------------------------------------------------------------------
  // FIND ONE
  // ---------------------------------------------------------------------------
  async findOne(id: number): Promise<OrderWithPeru> {
    if (!id) throw new BadRequestException('El ID es obligatorio');

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: fullOrderInclude,
    });

    if (!order) throw new NotFoundException(`Orden con ID ${id} no encontrada`);

    return this.addPeruFields(order);
  }

  // ---------------------------------------------------------------------------
  // UPDATE (MISMO DÍA – HORA PERÚ) ✅ FIX
  // ---------------------------------------------------------------------------
  async update(id: number, dto: UpdateOrderDto): Promise<OrderWithPeru> {
    const existingOrder = await this.prisma.order.findUnique({ where: { id } });

    if (!existingOrder) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    // ✅ comparar por FECHA Perú (string) para no depender del TZ del servidor
    const createdPeruDate = formatInTimeZone(
      existingOrder.createdAt,
      this.peruTz,
      'yyyy-MM-dd',
    );
    const nowPeruDate = formatInTimeZone(new Date(), this.peruTz, 'yyyy-MM-dd');

    if (createdPeruDate !== nowPeruDate) {
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

    return this.addPeruFields(updated);
  }

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------
  async remove(id: number): Promise<void> {
    const exists = await this.prisma.order.findUnique({ where: { id } });

    if (!exists)
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);

    await this.prisma.$transaction([
      this.prisma.orderItem.deleteMany({ where: { orderId: id } }),
      this.prisma.order.delete({ where: { id } }),
    ]);
  }

  // ---------------------------------------------------------------------------
  // CHECK EXISTING ORDER BY AREA + DATE (PERÚ)
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
  // FILTER BY DATE RANGE (PERÚ) ✅ FIX (fin exclusivo + ISO T)
  // ---------------------------------------------------------------------------
  async filterByDate(
    startDate: string,
    endDate: string,
  ): Promise<OrderWithPeru[]> {
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

    const startUtc = zonedTimeToUtc(`${startDate}T00:00:00.000`, this.peruTz);

    const endStartUtc = zonedTimeToUtc(`${endDate}T00:00:00.000`, this.peruTz);
    const endNextDayUtc = new Date(endStartUtc);
    endNextDayUtc.setUTCDate(endNextDayUtc.getUTCDate() + 1);

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: startUtc,
          lt: endNextDayUtc, // ✅ incluye todo el endDate Perú
        },
      },
      include: fullOrderInclude,
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => this.addPeruFields(o));
  }

  // ---------------------------------------------------------------------------
  // FIND BY USER ID (HISTORIAL USUARIO) ✅ FIX (DEVUELVE FECHA PERÚ)
  // ---------------------------------------------------------------------------
  async findByUserId(userId: number): Promise<OrderWithPeru[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: fullOrderInclude,
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => this.addPeruFields(o));
  }

  // ---------------------------------------------------------------------------
  // FIND ALL BY DAY (NO PAGINATION) ✅ FIX (fin exclusivo + ISO T + devuelve fecha Perú)
  // ---------------------------------------------------------------------------
  async findAllByDay(query: {
    date: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
    q?: string;
  }): Promise<OrderWithPeru[]> {
    const { date, sortBy, order = 'desc', q } = query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(
        'El parámetro "date" es obligatorio y debe tener formato YYYY-MM-DD.',
      );
    }

    const { startUtc, nextDayUtc } = this.getPeruDayRangeUtc(date);

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
      createdAt: {
        gte: startUtc,
        lt: nextDayUtc, // ✅ fin exclusivo
      },
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

    return orders.map((o) => this.addPeruFields(o));
  }
}
