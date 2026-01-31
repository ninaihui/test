import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createActivityDto: CreateActivityDto) {
    const activity = await this.prisma.activity.create({
      data: {
        name: createActivityDto.name,
        description: createActivityDto.description,
        date: new Date(createActivityDto.date),
        location: createActivityDto.location,
        venueId: createActivityDto.venueId,
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

  async findAll(userId: string, upcoming?: boolean) {
    const where: any = {};

    if (upcoming) {
      where.date = { gte: new Date() };
    }

    const activities = await this.prisma.activity.findMany({
      where,
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
      orderBy: {
        date: upcoming ? 'asc' : 'desc',
      },
    });

    return activities;
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

  /** 用户报名参加活动（创建出勤记录，状态为「已报名」） */
  async register(activityId: string, userId: string) {
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

    const attendance = await this.prisma.attendance.create({
      data: {
        userId,
        activityId,
        status: 'registered',
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
