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

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  // Crear una nueva orden
  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const { userId, areaId, totalAmount, status, orderItems } = createOrderDto;

    const order = await this.prisma.order.create({
      data: {
        userId,
        areaId,
        totalAmount,
        status,
        orderItems: {
          create: orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            unitMeasurementId: item.unitMeasurementId, // ✅ se agrega este campo
          })),
        },
      },
      include: {
        orderItems: {
          include: {
            product: true,
            unitMeasurement: true, // ✅ para que venga completa la info del ítem
          },
        },
        User: true,
        area: true,
      },
    });

    return order;
  }

  // Obtener todas las órdenes
  async findAll(): Promise<Order[]> {
    return this.prisma.order.findMany({
      include: {
        orderItems: {
          include: {
            product: true, // Incluye los detalles del producto
          },
        },
        User: true,
        area: true, // Incluye detalles del área si es necesario
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
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
    const { totalAmount, status, orderItems } = updateOrderDto;

    // Verificar si la orden existe antes de actualizar
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    const createdAt = new Date(existingOrder.createdAt);
    const now = new Date();

    const startOfDay = new Date(createdAt);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(startOfDay.getUTCDate() + 1);

    if (now < startOfDay || now >= endOfDay) {
      throw new BadRequestException(
        'La orden solo puede ser modificada durante el mismo día en que fue creada.',
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        totalAmount,
        status,
        orderItems: orderItems
          ? {
              deleteMany: {}, // Eliminar items existentes
              create: orderItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                unitMeasurementId: item.unitMeasurementId, // ✅ se agrega este campo
              })),
            }
          : undefined,
      },
      include: {
        orderItems: {
          include: {
            product: true,
            unitMeasurement: true, // ✅ incluir relación para mostrar en la respuesta
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

    // Verificación inicial de los parámetros
    if (!areaId) {
      throw new BadRequestException('El parámetro "areaId" es obligatorio.');
    }
    if (!date) {
      throw new BadRequestException('El parámetro "date" es obligatorio.');
    }

    // Conversión y validación de "areaId"
    const areaIdNumber = Number(areaId);
    if (isNaN(areaIdNumber)) {
      throw new BadRequestException(
        'El parámetro "areaId" debe ser un número.',
      );
    }

    // Validación de fecha en formato ISO8601
    const formattedDate = new Date(date);
    if (isNaN(formattedDate.getTime())) {
      throw new BadRequestException(
        'La fecha proporcionada no es válida. Debe estar en formato ISO8601.',
      );
    }

    // Definir el rango de 24 horas
    const startOfDay = new Date(formattedDate.setUTCHours(0, 0, 0, 0));
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(startOfDay.getUTCDate() + 1);

    console.log('Rango de búsqueda:', {
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
    });

    // Búsqueda de la orden en el rango de 24 horas
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
    // Verificar si las fechas están presentes
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Los parámetros "startDate" y "endDate" son obligatorios.',
      );
    }

    // Validar formato de fechas ISO8601
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        'Las fechas proporcionadas no son válidas. Deben estar en formato ISO8601.',
      );
    }

    // Asegurarse de que la fecha de inicio sea anterior a la fecha de fin
    if (start > end) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de fin.',
      );
    }

    console.log('Rango de búsqueda:', {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });

    // Búsqueda de órdenes en el rango de fechas
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
            unitMeasurement: true, // ✅ Aquí se incluye la unidad de medida
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
