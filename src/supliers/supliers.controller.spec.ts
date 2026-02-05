import { Test, TestingModule } from '@nestjs/testing';
import { SupliersController } from './supliers.controller';
import { SupliersService } from './supliers.service';

describe('SupliersController', () => {
  let controller: SupliersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupliersController],
      providers: [SupliersService],
    }).compile();

    controller = module.get<SupliersController>(SupliersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
