import { Injectable } from '@nestjs/common';
import { CreateUnitMeasurementDto } from './dto/create-unit-measurement.dto';
import { UpdateUnitMeasurementDto } from './dto/update-unit-measurement.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UnitMeasurement } from '@prisma/client';

@Injectable()
export class UnitMeasurementService {
  constructor(private prisma: PrismaService) {}

  // Crear una nueva unidad de medida
  async create(
    createUnitMeasurementDto: CreateUnitMeasurementDto,
  ): Promise<UnitMeasurement> {
    try {
      const unitMeasurement = await this.prisma.unitMeasurement.create({
        data: createUnitMeasurementDto,
      });
      return unitMeasurement;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error creating unit measurement: ${error.message}`);
      }
      throw new Error(
        'An unknown error occurred while creating the unit measurement',
      );
    }
  }

  // Obtener todas las unidades de medida
  async findAll(): Promise<UnitMeasurement[]> {
    try {
      return await this.prisma.unitMeasurement.findMany();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error fetching unit measurements: ${error.message}`);
      }
      throw new Error(
        'An unknown error occurred while fetching unit measurements',
      );
    }
  }

  // Obtener una unidad de medida específica por ID
  async findOne(id: number): Promise<UnitMeasurement> {
    try {
      const unitMeasurement = await this.prisma.unitMeasurement.findUnique({
        where: { id },
      });

      if (!unitMeasurement) {
        throw new Error(`Unit measurement with ID ${id} not found`);
      }

      return unitMeasurement;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error fetching unit measurement: ${error.message}`);
      }
      throw new Error(
        `An unknown error occurred while fetching unit measurement with ID ${id}`,
      );
    }
  }

  // Actualizar una unidad de medida existente
  async update(
    id: number,
    updateUnitMeasurementDto: UpdateUnitMeasurementDto,
  ): Promise<UnitMeasurement> {
    try {
      const existingUnitMeasurement =
        await this.prisma.unitMeasurement.findUnique({
          where: { id },
        });

      if (!existingUnitMeasurement) {
        throw new Error(`Unit measurement with ID ${id} not found`);
      }

      const updatedUnitMeasurement = await this.prisma.unitMeasurement.update({
        where: { id },
        data: updateUnitMeasurementDto,
      });

      return updatedUnitMeasurement;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error updating unit measurement: ${error.message}`);
      }
      throw new Error(
        `An unknown error occurred while updating unit measurement with ID ${id}`,
      );
    }
  }

  // Eliminar una unidad de medida por ID
  async remove(id: number): Promise<string> {
    try {
      const existingUnitMeasurement =
        await this.prisma.unitMeasurement.findUnique({
          where: { id },
        });

      if (!existingUnitMeasurement) {
        throw new Error(`Unit measurement with ID ${id} not found`);
      }

      await this.prisma.unitMeasurement.delete({
        where: { id },
      });

      return `Unit measurement with ID ${id} removed successfully`;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error removing unit measurement: ${error.message}`);
      }
      throw new Error(
        `An unknown error occurred while removing unit measurement with ID ${id}`,
      );
    }
  }
}
