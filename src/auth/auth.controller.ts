import { Controller, Post, Body, Logger } from '@nestjs/common';
import { AuthService } from './auth.service'; // importa el servicio
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {} // inyecta el servicio

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto); // usa authService
    return result;
  }
}
