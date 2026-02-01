import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createActivityDto: CreateActivityDto) {
    let maxParticipants = createActivityDto.maxParticipants != null ? createActivityDto.maxParticipants : 11;
    if (maxParticipants < 6) maxParticipants = 6;
    if (maxParticipants > 99) maxParticipants = 99;
    const activity = await this.prisma.activity.create({
      data: {
        name: createActivityDto.name,
        description: createActivityDto.description,
        date: new Date(createActivityDto.date),
        location: createActivityDto.location,
        venueId: createActivityDto.venueId,
        maxParticipants,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        _count: {
          select: {
            attendances: true,
          },
        },
      },
    });

    return activity;
  }

  async findAll(userId: string, _upcoming?: boolean) {
    const now = new Date();
    const activities = await this.prisma.activity.findMany({
      where: { date: { gte: now } },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        _count: {
          select: {
            attendances: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const activityIds = activities.map((a) => a.id);
    const myAttendanceActivityIds = new Set(
      (
        await this.prisma.attendance.findMany({
          where: { userId, activityId: { in: activityIds } },
          select: { activityId: true },
        })
      ).map((r) => r.activityId),
    );

    return activities.map((a) => ({
      ...a,
      isRegisteredByCurrentUser: myAttendanceActivityIds.has(a.id),
    }));
  }

  async findOne(id: string, _userId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                avatarUrl: true,
                playingPosition: true,
              },
            },
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    return activity;
  }

  async update(id: string, userId: string, updateActivityDto: UpdateActivityDto, userRole?: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    const isSystemAdmin = userRole === 'admin' || userRole === 'super_admin';
    if (activity.createdById !== userId && !isSystemAdmin) {
      throw new ForbiddenException('只有活动创建者或管理员可以修改活动');
    }

    const updatedActivity = await this.prisma.activity.update({
      where: { id },
      data: {
        ...updateActivityDto,
        date: updateActivityDto.date ? new Date(updateActivityDto.date) : undefined,
        venueId: updateActivityDto.venueId !== undefined ? updateActivityDto.venueId : undefined,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        _count: {
          select: {
            attendances: true,
          },
        },
      },
    });

    return updatedActivity;
  }

  /** 用户报名参加活动（创建出勤记录，状态为「已报名」），可选出场位置 position */
  async register(activityId: string, userId: string, position?: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    const existing = await this.prisma.attendance.findUnique({
      where: {
        userId_activityId: {
          userId,
          activityId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('您已报名过该活动');
    }

    const pos = position?.trim();
    if (pos) {
      const samePosition = await this.prisma.attendance.findFirst({
        where: { activityId, position: pos },
      });
      if (samePosition) {
        throw new ConflictException('位置重复了，请换个位置');
      }
    }

    const attendance = await this.prisma.attendance.create({
      data: {
        userId,
        activityId,
        status: 'registered',
        position: pos || undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
        activity: {
          select: {
            id: true,
            name: true,
            date: true,
            venue: { select: { id: true, name: true, address: true } },
            location: true,
          },
        },
      },
    });
    return attendance;
  }

  /** 用户取消报名（删除自己的出勤记录） */
  async unregister(activityId: string, userId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
    });
    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    const attendance = await this.prisma.attendance.findUnique({
      where: {
        userId_activityId: {
          userId,
          activityId,
        },
      },
    });
    if (!attendance) {
      throw new NotFoundException('您未报名该活动');
    }

    await this.prisma.attendance.delete({
      where: {
        userId_activityId: {
          userId,
          activityId,
        },
      },
    });
    return { message: '已取消报名' };
  }

  /** 管理员按战术板槽位保存本活动的出场位置（更新各报名记录的 position） */
  async updatePositions(activityId: string, _adminUserId: string, positions: { userId: string; position: string }[]) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
    });
    if (!activity) {
      throw new NotFoundException('活动不存在');
    }
    const maxParticipants = activity.maxParticipants != null && activity.maxParticipants >= 1 ? activity.maxParticipants : 11;
    if (positions.length > maxParticipants) {
      throw new BadRequestException(`出场人数不能超过活动人数上限（${maxParticipants} 人）`);
    }

    for (const item of positions) {
      const attendance = await this.prisma.attendance.findUnique({
        where: {
          userId_activityId: {
            userId: item.userId,
            activityId,
          },
        },
      });
      if (attendance) {
        await this.prisma.attendance.update({
          where: { id: attendance.id },
          data: { position: item.position.trim() || null },
        });
      }
    }
    return { message: '出场位置已保存' };
  }

  /** 当前用户保存本场自己的出场位置（普通用户战术板保存用） */
  async updateMyPosition(activityId: string, userId: string, position: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
    });
    if (!activity) {
      throw new NotFoundException('活动不存在');
    }
    const attendance = await this.prisma.attendance.findUnique({
      where: {
        userId_activityId: {
          userId,
          activityId,
        },
      },
    });
    if (!attendance) {
      throw new NotFoundException('您未报名该活动');
    }
    await this.prisma.attendance.update({
      where: { id: attendance.id },
      data: { position: (position || '').trim() || null },
    });
    return { message: '出场位置已保存' };
  }

  async remove(id: string, _userId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    await this.prisma.activity.delete({
      where: { id },
    });

    return { message: '活动已删除' };
  }
}
