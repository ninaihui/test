import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createAttendanceDto: CreateAttendanceDto) {
    // 检查活动是否存在
    const activity = await this.prisma.activity.findUnique({
      where: { id: createAttendanceDto.activityId },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    // 检查用户是否有权限记录出勤
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
        throw new ForbiddenException('您没有权限记录此活动的出勤');
      }
    } else if (activity.createdById !== userId) {
      throw new ForbiddenException('您没有权限记录此活动的出勤');
    }

    // 检查是否已存在
    const existing = await this.prisma.attendance.findUnique({
      where: {
        userId_activityId: {
          userId: userId,
          activityId: createAttendanceDto.activityId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('该活动的出勤记录已存在');
    }

    const attendance = await this.prisma.attendance.create({
      data: {
        userId,
        activityId: createAttendanceDto.activityId,
        status: createAttendanceDto.status || 'present',
        notes: createAttendanceDto.notes,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        activity: {
          select: {
            id: true,
            name: true,
            date: true,
          },
        },
      },
    });

    return attendance;
  }

  async findAll(userId: string, activityId?: string) {
    const where: any = {};

    if (activityId) {
      // 检查用户是否有权限查看
      const activity = await this.prisma.activity.findUnique({
        where: { id: activityId },
      });

      if (!activity) {
        throw new NotFoundException('活动不存在');
      }

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
          throw new ForbiddenException('您没有权限查看此活动的出勤记录');
        }
      } else if (activity.createdById !== userId) {
        throw new ForbiddenException('您没有权限查看此活动的出勤记录');
      }

      where.activityId = activityId;
    } else {
      // 只返回用户相关的出勤记录
      where.OR = [
        { userId },
        {
          activity: {
            OR: [
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
            ],
          },
        },
      ];
    }

    const attendances = await this.prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        activity: {
          select: {
            id: true,
            name: true,
            date: true,
            location: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return attendances;
  }

  async findOne(id: string, userId: string) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        activity: {
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundException('出勤记录不存在');
    }

    // 检查权限
    if (attendance.activity.teamId) {
      const teamMember = await this.prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId,
            teamId: attendance.activity.teamId,
          },
        },
      });

      if (!teamMember && attendance.activity.createdById !== userId && attendance.userId !== userId) {
        throw new ForbiddenException('您没有权限查看此出勤记录');
      }
    } else if (attendance.activity.createdById !== userId && attendance.userId !== userId) {
      throw new ForbiddenException('您没有权限查看此出勤记录');
    }

    return attendance;
  }

  async update(id: string, userId: string, updateAttendanceDto: UpdateAttendanceDto) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        activity: true,
      },
    });

    if (!attendance) {
      throw new NotFoundException('出勤记录不存在');
    }

    // 只有记录所有者或活动创建者可以修改
    if (attendance.userId !== userId && attendance.activity.createdById !== userId) {
      throw new ForbiddenException('您没有权限修改此出勤记录');
    }

    const updatedAttendance = await this.prisma.attendance.update({
      where: { id },
      data: updateAttendanceDto,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        activity: {
          select: {
            id: true,
            name: true,
            date: true,
          },
        },
      },
    });

    return updatedAttendance;
  }

  async remove(id: string, userId: string) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        activity: true,
      },
    });

    if (!attendance) {
      throw new NotFoundException('出勤记录不存在');
    }

    // 只有记录所有者或活动创建者可以删除
    if (attendance.userId !== userId && attendance.activity.createdById !== userId) {
      throw new ForbiddenException('您没有权限删除此出勤记录');
    }

    await this.prisma.attendance.delete({
      where: { id },
    });

    return { message: '出勤记录已删除' };
  }

  async getStatistics(userId: string, teamId?: string) {
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

      where.activity = {
        teamId,
      };
    } else {
      where.userId = userId;
    }

    const total = await this.prisma.attendance.count({
      where: {
        ...where,
      },
    });

    const present = await this.prisma.attendance.count({
      where: {
        ...where,
        status: 'present',
      },
    });

    const absent = await this.prisma.attendance.count({
      where: {
        ...where,
        status: 'absent',
      },
    });

    const late = await this.prisma.attendance.count({
      where: {
        ...where,
        status: 'late',
      },
    });

    const rate = total > 0 ? ((present / total) * 100).toFixed(2) : '0.00';

    return {
      total,
      present,
      absent,
      late,
      rate: `${rate}%`,
    };
  }
}
