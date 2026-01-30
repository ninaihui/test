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
import { join } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const ALLOWED_AVATAR_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heic',
};

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
          const ext = ALLOWED_AVATAR_MIME[file.mimetype] || '.jpg';
          cb(null, `${userId}-${Date.now()}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Security: block SVG and other scriptable image types
        if (!file.mimetype || !(file.mimetype in ALLOWED_AVATAR_MIME)) {
          return cb(new BadRequestException('只允许上传 jpg/jpeg/png/webp/gif/heic 图片（含苹果手机照片）'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
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
