import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { findContentFile, getContentDir } from './common/utils/content-utils';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  const defaultAllowedOrigins = [
    'https://toolseo.uk',
    'https://api.toolseo.uk',
    'http://localhost:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5000',
  ];

  const envOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : [];

  const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envOrigins])];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: any) => void) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.toolseo.uk') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, origin);
      }
      return callback(null, origin);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token', 'Accept', 'Origin', 'x-site-id'],
  });

  // Middleware phục vụ hình ảnh cục bộ /local-media
  app.use('/local-media', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const reqFile = decodeURIComponent(req.path.replace(/^\/+/, ''));
    const found = findContentFile(reqFile);
    if (found) {
      return res.sendFile(found);
    }
    next();
  }, express.static(getContentDir()));

  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 WP AutoPost Server (NestJS) đang chạy tại http://localhost:${port}`);
}

bootstrap();
