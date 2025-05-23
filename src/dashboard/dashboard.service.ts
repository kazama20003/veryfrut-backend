import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private getStartOfDayNDaysAgo(days: number): Date {
    const now = new Date();
    const nDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - days,
    );
    return nDaysAgo;
  }

  async getDashboardSummary() {
    const [
      totalProducts,
      totalOrders,
      totalSales,
      mostOrderedProducts,
      topUsersByOrders,
      latestUsers,
      recentOrdersGrouped,
      latestProducts,
    ] = await Promise.all([
      this.prisma.product.count(),

      this.prisma.order.count(),

      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
      }),

      this.prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),

      this.prisma.order.groupBy({
        by: ['userId'],
        _count: { userId: true },
        where: { userId: { not: null } },
        orderBy: { _count: { userId: 'desc' } },
        take: 5,
      }),

      this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          createdAt: true,
        },
      }),

      this.prisma.order.groupBy({
        by: ['createdAt'],
        _count: { id: true },
        _sum: { totalAmount: true },
        where: {
          createdAt: {
            gte: this.getStartOfDayNDaysAgo(7),
          },
        },
        orderBy: { createdAt: 'asc' },
      }),

      this.prisma.product.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      }),
    ]);

    const mostOrderedProductDetails = await Promise.all(
      mostOrderedProducts.map(async (p) => {
        const product = await this.prisma.product.findUnique({
          where: { id: p.productId },
          select: { id: true, name: true },
        });
        return {
          ...product,
          quantityOrdered: p._sum.quantity,
        };
      }),
    );

    const topUsersDetails = await Promise.all(
      topUsersByOrders.map(async (u) => {
        const user = await this.prisma.user.findUnique({
          where: { id: u.userId! },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        });
        return {
          ...user,
          orderCount: u._count.userId,
        };
      }),
    );

    return {
      totals: {
        products: totalProducts,
        orders: totalOrders,
        sales: totalSales._sum.totalAmount ?? 0,
      },
      analytics: {
        recentOrders: recentOrdersGrouped.map((order) => ({
          date: order.createdAt,
          count: order._count.id,
          total: order._sum.totalAmount,
        })),
      },
      topProducts: mostOrderedProductDetails,
      topUsers: topUsersDetails,
      latestUsers,
      latestProducts,
    };
  }
}
