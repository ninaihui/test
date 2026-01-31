import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async setAvatarUrl(userId: string, avatarUrl: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
    });

    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const data: { playingPosition?: string | null } = {};
    if (dto.playingPosition !== undefined) {
      data.playingPosition = dto.playingPosition === '' ? null : dto.playingPosition;
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        playingPosition: true,
      },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }
}
