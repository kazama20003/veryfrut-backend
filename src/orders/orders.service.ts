import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CheckOrderDto } from './dto/check-order.dto';
import { Order } from '@prisma/client';
import { toZonedTime } from 'date-fns-tz'; // Cambiado a la importación correcta

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  // Crear una nueva orden
  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const { userId, areaId, totalAmount, status, observation, orderItems } =
      createOrderDto;

    const order = await this.prisma.order.create({
      data: {
        userId,
        areaId,
        totalAmount,
        status,
        observation, // ✅ Se incluye correctamente
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

    return order;
  }

  // Obtener todas las órdenes
  // Obtener todas las órdenes con paginación
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
          orderItems: {
            include: {
              product: true,
            },
          },
          User: true,
          area: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.order.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: number): Promise<Order> {
    if (!id) {
      throw new BadRequestException('El ID es obligatorio');
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            unitMeasurement: true, // Solo la unidad de medida
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

  // Actualizar una orden
  // src/orders/orders.service.ts

  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const { totalAmount, status, observation, orderItems } = updateOrderDto;

    // Verificar si la orden existe antes de actualizar
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    // Zona horaria de Perú (America/Lima)
    const peruTimeZone = 'America/Lima';

    // Convertir fechas a la zona horaria de Perú
    const createdAtPeru = toZonedTime(existingOrder.createdAt, peruTimeZone);
    const nowPeru = toZonedTime(new Date(), peruTimeZone);

    // Obtener inicio y fin del día en horario de Perú
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
  // Eliminar una orden
  async remove(id: number): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    // Primero eliminar los items asociados a la orden
    await this.prisma.orderItem.deleteMany({
      where: { orderId: id },
    });

    // Luego eliminar la orden
    const deletedOrder = await this.prisma.order.delete({
      where: { id },
      include: {
        orderItems: true, // Esto ahora estará vacío porque ya los eliminaste
        User: true,
      },
    });

    return deletedOrder;
  }

  async findByUserId(userId: number): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        orderItems: {
          include: {
            unitMeasurement: true, // solo la unidad de medida
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

    const areaIdNumber = Number(areaId);
    if (isNaN(areaIdNumber)) {
      throw new BadRequestException(
        'El parámetro "areaId" debe ser un número.',
      );
    }

    const formattedDate = new Date(date);
    if (isNaN(formattedDate.getTime())) {
      throw new BadRequestException(
        'La fecha proporcionada no es válida. Debe estar en formato ISO8601.',
      );
    }

    // Horario de Perú
    const peruTimeZone = 'America/Lima';
    const zonedDate = toZonedTime(formattedDate, peruTimeZone);

    const startOfDay = new Date(zonedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    console.log('Rango de búsqueda:', {
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
    });

    const exists = await this.prisma.order.findFirst({
      where: {
        areaId: areaIdNumber,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    return { exists: exists !== null };
  }

  // Filtrar órdenes por rango de fechas
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
        'Las fechas proporcionadas no son válidas. Deben estar en formato ISO8601.',
      );
    }

    if (start > end) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de fin.',
      );
    }

    console.log('Rango de búsqueda:', {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
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

    return orders;
  }
}
