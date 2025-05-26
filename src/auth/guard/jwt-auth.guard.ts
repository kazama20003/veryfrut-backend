import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

interface DecodedUser {
  id: string;
  email: string;
  // Otros campos que el JWT pueda incluir
}

@Injectable()
export class JwtAuthGuard {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header not found');
    }

    // El encabezado debe tener el formato: "Bearer <token>"
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization format');
    }

    try {
      const decoded = this.jwtService.verify<DecodedUser>(token);
      request.user = decoded;
      return true;
    } catch (err) {
      console.error('Token verification failed:', err);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
