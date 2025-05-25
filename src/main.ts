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

  // Habilitar CORS solo para el dominio frontend
  app.enableCors({
    origin: ['https://veryfrut.com'], // Dominio de tu frontend permitido
    credentials: true, // Permitir cookies / headers con credenciales
  });

  // Arrancar el servidor en el puerto configurado
  await app.listen(envs.port);

  logger.log(`Back End running at http://localhost:${envs.port}`);
}
bootstrap();
