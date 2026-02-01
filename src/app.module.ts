import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { getThrottleConfig } from './common/throttle.config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ActivitiesModule } from './activities/activities.module';
import { VenuesModule } from './venues/venues.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot(getThrottleConfig()),
    PrismaModule,
    AuthModule,
    UsersModule,
    ActivitiesModule,
    VenuesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
