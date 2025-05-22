import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    const { email, password } = loginDto;

    try {
      const user: User | null = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new UnauthorizedException('Credenciales incorrectas');
      }

      const isPasswordValid: boolean = await bcrypt.compare(
        password,
        user.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Credenciales incorrectas');
      }

      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      const access_token = this.jwtService.sign(payload);
      return { access_token };
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Error al iniciar sesión:', err.message);
        // Aquí aseguramos que solo tratamos con el mensaje de error
      } else {
        console.error('Error desconocido:', err);
      }

      // Lanzamos una excepción si el error es conocido
      throw new UnauthorizedException('Error al intentar iniciar sesión');
    }
  }
}
