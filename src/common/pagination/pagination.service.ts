// src/common/pagination/pagination.service.ts
import { Injectable } from '@nestjs/common';
import { PaginatedResponse } from './paginated-response';

type OrderDirection = 'asc' | 'desc';

// Interfaz mínima: cualquier delegate de Prisma que tenga findMany y count
export interface PrismaFindManyCountDelegate<
  TEntity,
  TFindManyArgs,
  TCountArgs,
> {
  findMany(args: TFindManyArgs): Promise<TEntity[]>;
  count(args: TCountArgs): Promise<number>;
}

export type PaginateOptions<TFindManyArgs, TCountArgs> = {
  page?: number;
  limit?: number;
  findManyArgs: TFindManyArgs;
  countArgs: TCountArgs;
};

@Injectable()
export class PaginationService {
  async paginate<TEntity, TFindManyArgs, TCountArgs>(
    model: PrismaFindManyCountDelegate<TEntity, TFindManyArgs, TCountArgs>,
    options: PaginateOptions<TFindManyArgs, TCountArgs>,
  ): Promise<PaginatedResponse<TEntity>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;

    const skip = (page - 1) * limit;
    const take = limit;

    // Mezclamos args con skip/take (Prisma args típicos soportan esto)
    const findManyArgs = {
      ...(options.findManyArgs as object),
      skip,
      take,
    } as TFindManyArgs;

    const [data, total] = await Promise.all([
      model.findMany(findManyArgs),
      model.count(options.countArgs),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  buildOrderBy(sortBy?: string, order: OrderDirection = 'desc') {
    if (!sortBy) return undefined;
    return { [sortBy]: order } as Record<string, OrderDirection>;
  }
}
