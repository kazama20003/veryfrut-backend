import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { envs } from './config/envs';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Main');

  // Crear la aplicación NestJS
  const app = await NestFactory.create(AppModule);

  // Prefijo global para las rutas
  app.setGlobalPrefix('api');

  // Validación global de datos entrantes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors();

  // … (configuraciones previas)

  // Forzamos solo IPv4 en localhost
  await app.listen(envs.port, '127.0.0.1');

  logger.log(`Back End running at http://127.0.0.1:${envs.port}`);
}
bootstrap();
