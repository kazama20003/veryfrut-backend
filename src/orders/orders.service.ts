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
import { toZonedTime } from 'date-fns-tz';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

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
    page = 1,
    limit = 10,
  ): Promise<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        skip,
        take: limit,
        include: {
          orderItems: { include: { product: true } },
          User: true,
          area: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
    const createdAtPeru = toZonedTime(existingOrder.createdAt, peruTZ);
    const nowPeru = toZonedTime(new Date(), peruTZ);

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
      where: { userId },
      include: {
        orderItems: { include: { unitMeasurement: true } },
        User: true,
        area: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async checkExistingOrder(query: CheckOrderDto) {
    const { areaId, date } = query;

    if (!areaId)
      throw new BadRequestException('El parámetro "areaId" es obligatorio.');
    if (!date)
      throw new BadRequestException('El parámetro "date" es obligatorio.');

    const areaIdNum = Number(areaId);
    if (isNaN(areaIdNum)) {
      throw new BadRequestException(
        'El parámetro "areaId" debe ser un número.',
      );
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new BadRequestException(
        'Fecha inválida. Debe ser formato ISO8601.',
      );
    }

    const peruTZ = 'America/Lima';
    const zoned = toZonedTime(parsedDate, peruTZ);

    const startOfDay = new Date(zoned);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);

    const startUtc = new Date(startOfDay.toISOString());
    const endUtc = new Date(endOfDay.toISOString());

    const exists = await this.prisma.order.findFirst({
      where: {
        areaId: areaIdNum,
        createdAt: {
          gte: startUtc,
          lt: endUtc,
        },
      },
    });

    return { exists: exists !== null };
  }

  async filterByDate(startDate: string, endDate: string): Promise<Order[]> {
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Los parámetros "startDate" y "endDate" son obligatorios.',
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        'Fechas inválidas. Deben estar en formato ISO8601.',
      );
    }

    if (start > end) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de fin.',
      );
    }

    const tz = 'America/Lima';

    const startZoned = toZonedTime(start, tz);
    startZoned.setHours(0, 0, 0, 0);
    const endZoned = toZonedTime(end, tz);
    endZoned.setHours(23, 59, 59, 999);

    const startUtc = new Date(startZoned.toISOString());
    const endUtc = new Date(endZoned.toISOString());

    return this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: startUtc,
          lte: endUtc,
        },
      },
      include: {
        orderItems: { include: { product: true, unitMeasurement: true } },
        User: true,
        area: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
