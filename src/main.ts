import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Ambil env
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
  const HOST = process.env.HOST || '0.0.0.0';
  const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

  // CORS
  app.enableCors({ origin: FRONTEND_ORIGIN });

  // Validasi global
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Buat folder logs jika belum ada
  const logDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

  // Optional: redirect console log ke file
  const logFile = fs.createWriteStream(path.join(logDir, 'app.log'), {
    flags: 'a',
  });
  console.log = (...args) => {
    logFile.write(args.join(' ') + '\n');
  };

  await app.listen(PORT, HOST);
  console.log(`NestJS running on http://${HOST}:${PORT}`);
}
bootstrap();
