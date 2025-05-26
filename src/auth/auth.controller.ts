import { Controller, Post, Body, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    this.logger.log('➡️ Login llamado');
    this.logger.debug(JSON.stringify(loginDto));
    return this.authService.login(loginDto);
  }
  @Post('register')
  register(@Body() body: LoginDto) {
    this.logger.log('➡️ Register' + body.email);
    return { message: 'Registro exitoso' };
  }
}
