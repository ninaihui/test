import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // 配置静态文件服务
  // 首发：根路径由 Controller 接管（返回 login.html），避免 express static 自动返回 index.html
  app.useStaticAssets(join(__dirname, '..', 'public'), { index: false });
  
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
  await app.listen(port);
  console.log(`应用运行在 http://localhost:${port}`);
}
bootstrap();
