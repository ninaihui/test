import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ActivitiesModule } from './activities/activities.module';
import { VenuesModule } from './venues/venues.module';
import { UsersModule } from './users/users.module';
import { PhotosModule } from './photos/photos.module';
import { PublicModule } from './public/public.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: 60 },   // 每 IP 每分钟最多 60 次请求
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ActivitiesModule,
    VenuesModule,
    PhotosModule,
    PublicModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  controllers: [AppController],
})
export class AppModule {}
