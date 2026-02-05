import { Test, TestingModule } from '@nestjs/testing';
import { SupliersService } from './supliers.service';

describe('SupliersService', () => {
  let service: SupliersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SupliersService],
    }).compile();

    service = module.get<SupliersService>(SupliersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
