import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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

const deletedOrderInclude = {
  deletedOrderItems: true,
} as const;

/**
 * Order con todas sus relaciones (tipado automáticamente a partir de fullOrderInclude)
 */
type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof fullOrderInclude;
}>;

type DeletedOrderWithItems = Prisma.DeletedOrderGetPayload<{
  include: typeof deletedOrderInclude;
}>;

type DeletedOrderItemWithData = Omit<
  DeletedOrderWithItems['deletedOrderItems'][number],
  never
> & {
  product: OrderWithRelations['orderItems'][number]['product'] | null;
  unitMeasurement:
    | OrderWithRelations['orderItems'][number]['unitMeasurement']
    | null;
};

type DeletedOrderWithData = Omit<DeletedOrderWithItems, 'deletedOrderItems'> & {
  area: OrderWithRelations['area'] | null;
  User: OrderWithRelations['User'] | null;
  deletedOrderItems: DeletedOrderItemWithData[];
};

/**
 * Campos Perú extra
 */
type PeruDateFields = {
  createdAtPeruDate: string; // yyyy-MM-dd
  createdAtPeruTime: string; // HH:mm:ss
  createdAtPeru: string; // yyyy-MM-dd HH:mm:ss
  updatedAtPeru?: string; // yyyy-MM-dd HH:mm:ss
};

/**
 * ✅ Response final:
 * - mantiene todo lo demás igual
 * - PERO reemplaza createdAt/updatedAt por strings en hora Perú
 */
type OrderWithPeru = Omit<OrderWithRelations, 'createdAt' | 'updatedAt'> & {
  createdAt: string; // "yyyy-MM-dd HH:mm:ss" (Perú)
  updatedAt: string; // "yyyy-MM-dd HH:mm:ss" (Perú)
} & PeruDateFields;

type DeletedOrderWithPeru = Omit<
  DeletedOrderWithData,
  'originalCreatedAt' | 'originalUpdatedAt' | 'deletedAt'
> & {
  originalCreatedAt: string;
  originalUpdatedAt: string;
  deletedAt: string;
  originalCreatedAtPeruDate: string;
  originalCreatedAtPeruTime: string;
};

type WithItems<T> = { items: T[] };
type WithData<T> = { data: T[] };

@Injectable()
export class OrdersService {
  private readonly peruTz = 'America/Lima';
  private readonly orderOpeningTime = '06:00';
  private readonly orderClosingTime = '21:30';

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

    // ✅ recomendado: no depender de sumar 24h, pero Perú no tiene DST; igual lo dejamos estable
    const nextDayUtc = new Date(startUtc);
    nextDayUtc.setUTCDate(nextDayUtc.getUTCDate() + 1);

    return { startUtc, nextDayUtc };
  }

  /**
   * ✅ Acá está el cambio clave:
   * - convertimos createdAt/updatedAt a string en hora Perú
   * - y además dejamos tus createdAtPeru* como venías haciendo
   */
  private addPeruFields(order: OrderWithRelations): OrderWithPeru {
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

    const updatedAtPeru = formatInTimeZone(
      order.updatedAt,
      this.peruTz,
      'yyyy-MM-dd HH:mm:ss',
    );

    const base: OrderWithPeru = {
      ...order,
      // ✅ estos son los que el FRONT ya usa
      createdAt: createdAtPeru, // string Perú
      updatedAt: updatedAtPeru, // string Perú

      // ✅ extras
      createdAtPeruDate,
      createdAtPeruTime,
      createdAtPeru,
      updatedAtPeru,
    };

    return base;
  }

  private addDeletedOrderPeruFields(
    order: DeletedOrderWithData,
  ): DeletedOrderWithPeru {
    const originalCreatedAtPeruDate = formatInTimeZone(
      order.originalCreatedAt,
      this.peruTz,
      'yyyy-MM-dd',
    );
    const originalCreatedAtPeruTime = formatInTimeZone(
      order.originalCreatedAt,
      this.peruTz,
      'HH:mm:ss',
    );

    return {
      ...order,
      originalCreatedAt: formatInTimeZone(
        order.originalCreatedAt,
        this.peruTz,
        'yyyy-MM-dd HH:mm:ss',
      ),
      originalUpdatedAt: formatInTimeZone(
        order.originalUpdatedAt,
        this.peruTz,
        'yyyy-MM-dd HH:mm:ss',
      ),
      deletedAt: formatInTimeZone(
        order.deletedAt,
        this.peruTz,
        'yyyy-MM-dd HH:mm:ss',
      ),
      originalCreatedAtPeruDate,
      originalCreatedAtPeruTime,
    };
  }

  private uniqueNumbers(values: Array<number | null | undefined>): number[] {
    return [...new Set(values.filter((value): value is number => !!value))];
  }

  private async hydrateDeletedOrders(
    orders: DeletedOrderWithItems[],
  ): Promise<DeletedOrderWithData[]> {
    if (orders.length === 0) return [];

    const areaIds = this.uniqueNumbers(orders.map((order) => order.areaId));
    const userIds = this.uniqueNumbers(orders.map((order) => order.userId));
    const productIds = this.uniqueNumbers(
      orders.flatMap((order) =>
        order.deletedOrderItems.map((item) => item.productId),
      ),
    );
    const unitMeasurementIds = this.uniqueNumbers(
      orders.flatMap((order) =>
        order.deletedOrderItems.map((item) => item.unitMeasurementId),
      ),
    );

    const [areas, users, products, unitMeasurements] = await Promise.all([
      this.prisma.area.findMany({
        where: { id: { in: areaIds } },
        include: { company: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          role: true,
        },
      }),
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { category: true },
      }),
      this.prisma.unitMeasurement.findMany({
        where: { id: { in: unitMeasurementIds } },
      }),
    ]);

    const areaById = new Map(areas.map((area) => [area.id, area]));
    const userById = new Map(users.map((user) => [user.id, user]));
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    const unitMeasurementById = new Map(
      unitMeasurements.map((unitMeasurement) => [
        unitMeasurement.id,
        unitMeasurement,
      ]),
    );

    return orders.map((order) => ({
      ...order,
      area: areaById.get(order.areaId) ?? null,
      User: order.userId ? (userById.get(order.userId) ?? null) : null,
      deletedOrderItems: order.deletedOrderItems.map((item) => ({
        ...item,
        product: productById.get(item.productId) ?? null,
        unitMeasurement:
          unitMeasurementById.get(item.unitMeasurementId) ?? null,
      })),
    }));
  }

  // ✅ Type-guards sin any
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
    if (this.hasItems<OrderWithRelations>(res)) {
      const mappedItems = res.items.map((o) => this.addPeruFields(o));
      const base = res;
      return {
        ...(base as unknown as Omit<PaginatedResponse<OrderWithPeru>, 'items'>),
        items: mappedItems,
      } as PaginatedResponse<OrderWithPeru>;
    }

    if (this.hasData<OrderWithRelations>(res)) {
      const mappedData = res.data.map((o) => this.addPeruFields(o));
      const base = res;
      return {
        ...(base as unknown as Omit<PaginatedResponse<OrderWithPeru>, 'data'>),
        data: mappedData,
      } as PaginatedResponse<OrderWithPeru>;
    }

    return res as unknown as PaginatedResponse<OrderWithPeru>;
  }

  private async existsOrderForScheduledDate(
    areaId: number,
    peruDate: string,
  ): Promise<boolean> {
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        areaId,
        scheduledFor: new Date(`${peruDate}T00:00:00.000Z`),
      },
      select: { id: true },
    });

    return !!existingOrder;
  }

  private ensureOrderWindowIsOpen(): void {
    const timeInPeru = formatInTimeZone(new Date(), this.peruTz, 'HH:mm');

    if (
      timeInPeru < this.orderOpeningTime ||
      timeInPeru >= this.orderClosingTime
    ) {
      throw new ForbiddenException(
        'La recepción de pedidos está disponible desde las 6:00 a. m. Comunícate con el administrador al 987 801 148.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------
  async create(
    dto: CreateOrderDto,
    userRole?: string,
  ): Promise<OrderWithPeru> {
    const todayPeruDate = formatInTimeZone(
      new Date(),
      this.peruTz,
      'yyyy-MM-dd',
    );

    if (userRole !== 'admin') {
      this.ensureOrderWindowIsOpen();
    }

    const scheduledFor =
      userRole === 'admin' && dto.scheduledFor
        ? this.normalizeToPeruDate(dto.scheduledFor)
        : todayPeruDate;

    if (scheduledFor < todayPeruDate) {
      throw new BadRequestException(
        'No se pueden crear pedidos para fechas pasadas.',
      );
    }

    const alreadyExistsForArea = await this.existsOrderForScheduledDate(
      dto.areaId,
      scheduledFor,
    );

    if (alreadyExistsForArea) {
      throw new BadRequestException(
        `Ya existe una orden registrada para el area ${dto.areaId} en la fecha ${scheduledFor}.`,
      );
    }

    const created = await this.prisma.order.create({
      data: {
        userId: dto.userId,
        areaId: dto.areaId,
        totalAmount: dto.totalAmount,
        status: dto.status,
        observation: dto.observation,
        scheduledFor: new Date(`${scheduledFor}T00:00:00.000Z`),
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
  // UPDATE (MISMO DÍA – HORA PERÚ)
  // ---------------------------------------------------------------------------
  async update(id: number, dto: UpdateOrderDto): Promise<OrderWithPeru> {
    const existingOrder = await this.prisma.order.findUnique({ where: { id } });

    if (!existingOrder) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

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
  async remove(id: number, deletedByRole?: string): Promise<void> {
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: true,
      },
    });

    if (!existingOrder)
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);

    const shouldArchive = deletedByRole?.toLowerCase() === 'admin';

    if (!shouldArchive) {
      await this.prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.order.delete({ where: { id } });
      });
      return;
    }

    const alreadyArchived = await this.prisma.deletedOrder.findUnique({
      where: { originalOrderId: id },
      select: { id: true },
    });

    if (alreadyArchived) {
      throw new BadRequestException(
        `La orden con ID ${id} ya existe en la papelera.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.deletedOrder.create({
        data: {
          originalOrderId: existingOrder.id,
          areaId: existingOrder.areaId,
          userId: existingOrder.userId,
          totalAmount: existingOrder.totalAmount,
          status: existingOrder.status,
          observation: existingOrder.observation,
          scheduledFor: existingOrder.scheduledFor,
          originalCreatedAt: existingOrder.createdAt,
          originalUpdatedAt: existingOrder.updatedAt,
          deletedOrderItems: {
            create: existingOrder.orderItems.map((item) => ({
              originalItemId: item.id,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              unitMeasurementId: item.unitMeasurementId,
            })),
          },
        },
      });

      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id } });
    });
  }

  // ---------------------------------------------------------------------------
  // DELETED ORDERS
  // ---------------------------------------------------------------------------
  async findDeleted(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<DeletedOrderWithPeru>> {
    const { page = 1, limit = 10, sortBy, order = 'desc', q } = query;

    const allowedSortFields = new Set<
      keyof Prisma.DeletedOrderOrderByWithRelationInput
    >([
      'id',
      'originalOrderId',
      'areaId',
      'userId',
      'totalAmount',
      'status',
      'originalCreatedAt',
      'originalUpdatedAt',
      'deletedAt',
    ]);

    const safeSortBy = allowedSortFields.has(
      sortBy as keyof Prisma.DeletedOrderOrderByWithRelationInput,
    )
      ? sortBy
      : 'deletedAt';

    const orderBy = this.pagination.buildOrderBy(safeSortBy, order);
    const qAsNumber = Number(q);

    const where: Prisma.DeletedOrderWhereInput | undefined = q
      ? {
          OR: [
            ...(Number.isFinite(qAsNumber)
              ? [
                  { id: qAsNumber },
                  { originalOrderId: qAsNumber },
                  { areaId: qAsNumber },
                ]
              : []),
            {
              observation: {
                contains: q,
                mode: 'insensitive',
              },
            },
            {
              status: {
                contains: q,
                mode: 'insensitive',
              },
            },
          ],
        }
      : undefined;

    const delegate = {
      findMany: (args: Prisma.DeletedOrderFindManyArgs) =>
        this.prisma.deletedOrder.findMany(args) as Promise<
          DeletedOrderWithItems[]
        >,
      count: (args: Prisma.DeletedOrderCountArgs) =>
        this.prisma.deletedOrder.count(args),
    };

    const result = await this.pagination.paginate<
      DeletedOrderWithItems,
      Prisma.DeletedOrderFindManyArgs,
      Prisma.DeletedOrderCountArgs
    >(delegate, {
      page,
      limit,
      findManyArgs: {
        where,
        include: deletedOrderInclude,
        orderBy,
      },
      countArgs: { where },
    });

    const hydratedOrders = await this.hydrateDeletedOrders(result.data);

    return {
      ...result,
      data: hydratedOrders.map((o) => this.addDeletedOrderPeruFields(o)),
    };
  }

  async findDeletedOne(id: number): Promise<DeletedOrderWithPeru> {
    if (!id) throw new BadRequestException('El ID es obligatorio');

    const deletedOrder = await this.prisma.deletedOrder.findUnique({
      where: { id },
      include: deletedOrderInclude,
    });

    if (!deletedOrder) {
      throw new NotFoundException(`Orden eliminada con ID ${id} no encontrada`);
    }

    const [hydratedOrder] = await this.hydrateDeletedOrders([deletedOrder]);

    return this.addDeletedOrderPeruFields(hydratedOrder);
  }

  async restoreDeleted(id: number): Promise<OrderWithPeru> {
    if (!id) throw new BadRequestException('El ID es obligatorio');

    const deletedOrder = await this.prisma.deletedOrder.findUnique({
      where: { id },
      include: deletedOrderInclude,
    });

    if (!deletedOrder) {
      throw new NotFoundException(`Orden eliminada con ID ${id} no encontrada`);
    }

    const activeOrderWithSameId = await this.prisma.order.findUnique({
      where: { id: deletedOrder.originalOrderId },
      select: { id: true },
    });

    if (activeOrderWithSameId) {
      throw new BadRequestException(
        `Ya existe una orden activa con ID ${deletedOrder.originalOrderId}.`,
      );
    }

    const scheduledFor = formatInTimeZone(
      deletedOrder.scheduledFor,
      'UTC',
      'yyyy-MM-dd',
    );
    const alreadyExistsForArea = await this.existsOrderForScheduledDate(
      deletedOrder.areaId,
      scheduledFor,
    );

    if (alreadyExistsForArea) {
      throw new BadRequestException(
        `Ya existe una orden activa para el area ${deletedOrder.areaId} en la fecha ${scheduledFor}.`,
      );
    }

    try {
      const restored = await this.prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            id: deletedOrder.originalOrderId,
            userId: deletedOrder.userId,
            areaId: deletedOrder.areaId,
            totalAmount: deletedOrder.totalAmount,
            status: deletedOrder.status,
          observation: deletedOrder.observation,
          scheduledFor: deletedOrder.scheduledFor,
            createdAt: deletedOrder.originalCreatedAt,
            updatedAt: deletedOrder.originalUpdatedAt,
            orderItems: {
              create: deletedOrder.deletedOrderItems.map((item) => ({
                id: item.originalItemId,
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                unitMeasurementId: item.unitMeasurementId,
              })),
            },
          },
          include: fullOrderInclude,
        });

        await tx.deletedOrder.delete({ where: { id } });
        return created;
      });

      return this.addPeruFields(restored);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'No se pudo restaurar porque falta una referencia relacionada (area, usuario, producto o unidad de medida).',
        );
      }

      throw error;
    }
  }

  async removeDeleted(id: number): Promise<{ message: string }> {
    if (!id) throw new BadRequestException('El ID es obligatorio');

    const deletedOrder = await this.prisma.deletedOrder.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!deletedOrder) {
      throw new NotFoundException(`Orden eliminada con ID ${id} no encontrada`);
    }

    await this.prisma.deletedOrder.delete({ where: { id } });

    return { message: `Orden eliminada con ID ${id} borrada definitivamente` };
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
    const exists = await this.existsOrderForScheduledDate(areaIdNum, peruDate);
    return { exists };
  }

  async followUp(date: string, userRole?: string) {
    if (userRole !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden ver el seguimiento de pedidos.');
    }

    const peruDate = this.normalizeToPeruDate(date);
    const selectedDate = new Date(`${peruDate}T00:00:00.000Z`);

    const [users, ordersForDate, futureOrders] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'customer' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          areas: { include: { company: true } },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      this.prisma.order.findMany({
        where: { scheduledFor: selectedDate },
        include: fullOrderInclude,
      }),
      this.prisma.order.findMany({
        where: { scheduledFor: { gt: selectedDate } },
        include: fullOrderInclude,
        orderBy: { scheduledFor: 'asc' },
      }),
    ]);

    const orderByAreaId = new Map(
      ordersForDate.map((order) => [order.areaId, this.addPeruFields(order)]),
    );

    return {
      date: peruDate,
      users: users.map(({ areas, ...user }) => ({
        ...user,
        areas: areas.map((area) => ({
          ...area,
          order: orderByAreaId.get(area.id) ?? null,
        })),
      })),
      futureOrders: futureOrders.map((order) => this.addPeruFields(order)),
    };
  }

  // ---------------------------------------------------------------------------
  // FILTER BY DATE RANGE (PERÚ)
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
          lt: endNextDayUtc,
        },
      },
      include: fullOrderInclude,
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => this.addPeruFields(o));
  }

  // ---------------------------------------------------------------------------
  // FIND BY USER ID
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
  // FIND ALL BY DAY (NO PAGINATION)
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
        lt: nextDayUtc,
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
