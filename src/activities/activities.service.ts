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
    // 如果指定了球队，检查用户是否是球队成员
    if (createActivityDto.teamId) {
      const teamMember = await this.prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId,
            teamId: createActivityDto.teamId,
          },
        },
      });

      if (!teamMember) {
        throw new ForbiddenException('您不是该球队的成员');
      }
    }

    const activity = await this.prisma.activity.create({
      data: {
        name: createActivityDto.name,
        description: createActivityDto.description,
        date: new Date(createActivityDto.date),
        location: createActivityDto.location,
        venueId: createActivityDto.venueId,
        createdById: userId,
        teamId: createActivityDto.teamId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
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

  async findAll(userId: string, teamId?: string, upcoming?: boolean) {
    const where: any = {};

    if (upcoming) {
      where.date = { gte: new Date() };
    }

    if (teamId) {
      // 检查用户是否是球队成员
      const teamMember = await this.prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId,
            teamId,
          },
        },
      });

      if (!teamMember) {
        throw new ForbiddenException('您不是该球队的成员');
      }

      where.teamId = teamId;
    } else {
      // 只返回用户创建的活动或用户所在球队的活动
      where.OR = [
        { createdById: userId },
        {
          team: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
      ];
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
        team: {
          select: {
            id: true,
            name: true,
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

  async findOne(id: string, userId: string) {
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
        team: {
          select: {
            id: true,
            name: true,
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

    // 检查用户是否有权限查看
    if (activity.teamId) {
      const teamMember = await this.prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId,
            teamId: activity.teamId,
          },
        },
      });

      if (!teamMember && activity.createdById !== userId) {
        throw new ForbiddenException('您没有权限查看此活动');
      }
    } else if (activity.createdById !== userId) {
      throw new ForbiddenException('您没有权限查看此活动');
    }

    return activity;
  }

  async update(id: string, userId: string, updateActivityDto: UpdateActivityDto) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    // 只有创建者可以修改
    if (activity.createdById !== userId) {
      throw new ForbiddenException('只有活动创建者可以修改活动');
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
        team: {
          select: {
            id: true,
            name: true,
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
      include: { team: true },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    // 若有球队，仅球队成员可报名
    if (activity.teamId) {
      const teamMember = await this.prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId,
            teamId: activity.teamId,
          },
        },
      });
      if (!teamMember && activity.createdById !== userId) {
        throw new ForbiddenException('仅球队成员可报名此活动');
      }
    } else if (activity.createdById !== userId) {
      throw new ForbiddenException('仅活动创建者或指定球队成员可报名');
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

  async remove(id: string, userId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    // 只有创建者可以删除
    if (activity.createdById !== userId) {
      throw new ForbiddenException('只有活动创建者可以删除活动');
    }

    await this.prisma.activity.delete({
      where: { id },
    });

    return { message: '活动已删除' };
  }
}
