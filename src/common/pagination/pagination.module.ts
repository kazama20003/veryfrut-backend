// src/common/pagination/pagination.module.ts
import { Global, Module } from '@nestjs/common';
import { PaginationService } from './pagination.service';

@Global()
@Module({
  providers: [PaginationService],
  exports: [PaginationService],
})
export class PaginationModule {}
