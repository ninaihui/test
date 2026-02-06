import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
    PrismaModule,
    AuthModule,
    UsersModule,
    ActivitiesModule,
    VenuesModule,
    PhotosModule,
    PublicModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
