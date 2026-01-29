import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = join(process.cwd(), 'public', 'uploads', 'avatars');
          ensureDir(dest);
          cb(null, dest);
        },
        filename: (req: any, file, cb) => {
          const userId = req.user?.sub || 'unknown';
          const safeExt = extname(file.originalname || '').toLowerCase() || '.jpg';
          cb(null, `${userId}-${Date.now()}${safeExt}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          return cb(new BadRequestException('只允许上传图片'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadMyAvatar(@Request() req, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('未收到文件');

    // Served by useStaticAssets(public)
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return this.usersService.setAvatarUrl(req.user.sub, avatarUrl);
  }
}
