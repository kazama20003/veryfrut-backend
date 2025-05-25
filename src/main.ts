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
    origin: 'https://veryfrut.com',
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, Origin',
  });
  await app.listen(envs.port, '0.0.0.0');

  logger.log(`Back End running at http://localhost:${envs.port}`);
}
bootstrap();
