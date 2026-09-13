import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
      // Allow requests with no origin (same-origin, curl, server-to-server).
      if (!origin) return callback(null, true);
      const allowed = (process.env.CLIENT_ORIGIN ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (allowed.length === 0 || allowed.includes('*') || allowed.includes(origin)) {
        return callback(null, true);
      }
      // In dev, reflect any origin so LAN / IP access works.
      if ((process.env.NODE_ENV ?? 'development') === 'development') {
        return callback(null, origin);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Mob Duel Jr API listening on http://localhost:${port}/api`);
}

void bootstrap();
