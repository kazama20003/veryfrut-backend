import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      const user = await this.prisma.user.create({
        data: {
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          email: createUserDto.email,
          phone: createUserDto.phone,
          address: createUserDto.address,
          role: createUserDto.role,
          password: hashedPassword,
          areas: {
            connect: createUserDto.areaIds.map((id) => ({ id })),
          },
        },
        include: {
          areas: true,
        },
      });

      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new InternalServerErrorException('Error al crear el usuario');
    }
  }

  async findAll(): Promise<User[]> {
    try {
      return await this.prisma.user.findMany({
        include: {
          areas: true, // si quieres incluir los datos del área
        },
      });
    } catch (error) {
      console.error('Error retrieving users:', error);
      throw new InternalServerErrorException('Error al obtener los usuarios');
    }
  }

  async findOne(id: number): Promise<User> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          areas: true,
        },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      return user;
    } catch (error) {
      console.error('Error finding user:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al buscar el usuario');
    }
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      // Verificamos que el usuario exista antes de actualizar
      const userExists = await this.prisma.user.findUnique({ where: { id } });

      if (!userExists) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      const { areaIds, ...rest } = updateUserDto;

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          ...rest,
          areas: areaIds ? { set: areaIds.map((id) => ({ id })) } : undefined,
        },
        include: {
          areas: true,
        },
      });

      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al actualizar el usuario');
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    try {
      const userExists = await this.prisma.user.findUnique({ where: { id } });

      if (!userExists) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      await this.prisma.user.delete({
        where: { id },
      });

      return { message: `Usuario con ID ${id} eliminado correctamente` };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al eliminar el usuario');
    }
  }

  async updatePassword(
    id: number,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id } });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      const passwordMatch = await bcrypt.compare(
        updatePasswordDto.currentPassword,
        user.password,
      );

      if (!passwordMatch) {
        throw new Error('La contraseña actual no es correcta');
      }

      const newHashedPassword = await bcrypt.hash(
        updatePasswordDto.newPassword,
        10,
      );

      await this.prisma.user.update({
        where: { id },
        data: { password: newHashedPassword },
      });

      return { message: 'Contraseña actualizada correctamente' };
    } catch (error) {
      console.error('Error updating password:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error al actualizar la contraseña');
    }
  }
}
