import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PhotosService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(limit = 24) {
    const take = Math.min(60, Math.max(1, Number(limit) || 24));
    const rows = await this.prisma.photo.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        createdAt: true,
        activityId: true,
      },
    });
    return rows;
  }

  async create(createdById: string, url: string, activityId?: string | null) {
    const u = (url || '').trim();
    if (!u) throw new BadRequestException('缺少图片地址');
    return this.prisma.photo.create({
      data: {
        url: u,
        createdById,
        activityId: activityId || null,
      },
      select: { id: true, url: true, createdAt: true, activityId: true },
    });
  }
}
