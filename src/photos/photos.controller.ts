import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Request,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { PhotosService } from './photos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  // Public showcase feed
  @Get('public/photos')
  listPublic(@Query('limit') limit?: string) {
    return this.photosService.listPublic(limit ? Number(limit) : 24);
  }

  // Upload (admin only)
  @Post('photos/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, join(process.cwd(), 'public', 'uploads', 'photos'));
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase() || '.jpg';
          cb(null, `${Date.now()}_${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async upload(
    @Request() req: any,
    @UploadedFile() file: any,
    @Body('activityId') activityId?: string,
  ) {
    if (!file) throw new Error('缺少文件');
    const url = `/uploads/photos/${file.filename}`;
    return this.photosService.create(req.user.sub, url, activityId || null);
  }
}
