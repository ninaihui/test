import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Basic security headers
  app.use(
    helmet({
      // keep relaxed for MVP static pages; can be tightened later
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Response compression
  app.use((compression as any)());

  // 静态资源：从项目根目录的 public 提供（与运行 dist 时的 cwd 一致，避免 __dirname 导致路径错误）
  const publicDir = join(process.cwd(), 'public');
  app.useStaticAssets(publicDir, { index: false });

  // 启用全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS: allow all by default for MVP; can be restricted with env later
  app.enableCors();

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`应用运行在 http://localhost:${port}（局域网访问请用本机 IP:${port}）`);
}
bootstrap();
