import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
@Module({
  imports: [
    JwtModule.register({
      secret: 'your-secret-key', // Cambia esto a una clave segura y mantenla en un archivo de configuración
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, JwtAuthGuard],
  exports: [JwtModule], // Exporta AuthService y JwtAuthGuard si los necesitas en otros módulos
})
export class AuthModule {}
