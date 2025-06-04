import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { envs } from './config/envs';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Main');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Forzar sólo IPv4 (opcional, pero recomendado en este entorno)
  const host = '127.0.0.1';
  const port = envs.port;

  // <-- Habilitamos CORS aquí, con el origen de tu frontend
  app.enableCors({
    origin: ['https://veryfrut.com', 'https://www.veryfrut.com'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Si manejas cookies / credenciales
    preflightContinue: false, // Dejar que NestJS responda el OPTIONS internamente
    optionsSuccessStatus: 204, // Status para respuestas OPTIONS
  });

  await app.listen(port, host);
  logger.log(`Back End running at http://${host}:${port}`);
}
bootstrap();
