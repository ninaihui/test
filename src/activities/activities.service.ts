import {
  Injectable,
  NotFoundException,
  ForbiddenException,
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
        _count: {
          select: {
            attendances: true,
          },
        },
      },
    });

    return activity;
  }

  async findAll(userId: string, teamId?: string) {
    const where: any = {};

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
        _count: {
          select: {
            attendances: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
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
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
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
        _count: {
          select: {
            attendances: true,
          },
        },
      },
    });

    return updatedActivity;
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
