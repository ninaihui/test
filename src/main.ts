import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';

function ms(): number {
  return Date.now();
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const expressApp = app.getHttpAdapter().getInstance();
  // 基础安全：隐藏框架标识
  expressApp.disable('x-powered-by');

  // 请求追踪：生成 request id + 结构化访问日志
  app.use((req: any, res: any, next: any) => {
    const start = ms();
    const reqId = req.headers['x-request-id'] || randomUUID();
    req.id = reqId;
    res.setHeader('X-Request-Id', reqId);

    res.on('finish', () => {
      const costMs = ms() - start;
      const status = res.statusCode;
      const method = req.method;
      const path = req.originalUrl || req.url;
      // 单行日志，便于 grep / 聚合
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          t: new Date().toISOString(),
          reqId,
          method,
          path,
          status,
          costMs,
          ip: req.ip,
        }),
      );
    });

    next();
  });

  // 基础安全响应头（轻量版 helmet）
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  });

  // 缓存策略：HTML 不缓存；静态资源适度缓存（配合 ?v= 进行变更失效）
  app.use((req: any, res: any, next: any) => {
    const p = (req.path || '').toLowerCase();
    if (p.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }
    if (p.startsWith('/assets/') || p.startsWith('/js/')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return next();
    }
    return next();
  });

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

  // 启用 CORS（如果需要）
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`应用运行在 http://localhost:${port}（局域网访问请用本机 IP:${port}）`);
}
bootstrap();
