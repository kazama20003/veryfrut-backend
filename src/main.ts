import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { envs } from './config/envs';
import { ValidationPipe } from '@nestjs/common';
async function bootstrap() {
  const logger = new Logger('Main');
  // Prefijo global para las rutas
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors();
  await app.listen(envs.port); // 👈 aquí pasamos el puerto correctamente
  logger.log(`Back End running at http://localhost:${envs.port}`);
}
bootstrap();
