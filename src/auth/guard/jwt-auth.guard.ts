import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express'; // Importa el tipo Request de Express

// Define la interfaz para el usuario que se obtiene al decodificar el JWT
interface DecodedUser {
  id: string;
  email: string;
  // Otros campos que el JWT pueda incluir
}

@Injectable()
export class JwtAuthGuard {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>(); // Tipamos el request
    const token = request.headers['authorization']; // El token ahora será directamente el valor del encabezado

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    try {
      // Aquí verificamos el token sin el prefijo 'Bearer'
      const decoded = this.jwtService.verify<DecodedUser>(token); // Asegúrate de que jwtService.verify esté tipado correctamente
      request.user = decoded; // Aquí asignamos el usuario decodificado
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
