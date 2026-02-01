import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string) {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          avatarUrl: true,
          playingPosition: true,
        },
      });
    } catch (e: any) {
      if (e?.message?.includes('playingPosition') || e?.code === 'P2010') {
        return this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, email: true, avatarUrl: true },
        });
      }
      throw e;
    }
  }

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
    if (Object.keys(data).length === 0) {
      return this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true, avatarUrl: true, playingPosition: true },
      });
    }
    try {
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
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (
        msg.includes('playingPosition') ||
        msg.includes('column') ||
        msg.includes('Unknown') ||
        e?.code === 'P2010' ||
        e?.code === 'P2002'
      ) {
        throw new BadRequestException(
          '数据库尚未执行「上场位置」迁移。请在项目根目录执行: npx prisma migrate deploy',
        );
      }
      throw e;
    }
  }
}
