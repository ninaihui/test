import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateActivityTeamsDto } from './dto/update-activity-teams.dto';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  private async canEditActivityTeams(activityId: string, userId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, teamId: true, createdById: true, teamCount: true, teamFormations: true },
    });
    if (!activity) throw new NotFoundException('活动不存在');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'admin') return true;

    if (activity.teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: activity.teamId },
        select: { adminUserId: true },
      });
      if (team?.adminUserId && team.adminUserId === userId) return true;
    }

    // 无球队活动：创建者可改；有球队活动：创建者也可改（避免无管理员时无法保存）
    return activity.createdById === userId;
  }

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

    const teamCount = createActivityDto.teamCount ?? 2;
    const teamNames = (createActivityDto.teamNames || []).slice(0, 4);
    const normalizedTeamNames = Array.from({ length: teamCount }, (_, i) => {
      const raw = teamNames[i];
      return (raw || '').trim() || `队伍${i + 1}`;
    });

    const normalizedFormations = Array.from({ length: teamCount }, () => '4-4-2');

    const activity = await this.prisma.activity.create({
      data: {
        name: createActivityDto.name,
        description: createActivityDto.description,
        date: new Date(createActivityDto.date),
        location: createActivityDto.location,
        createdById: userId,
        teamId: createActivityDto.teamId,
        teamCount,
        teamNames: normalizedTeamNames,
        teamFormations: normalizedFormations,
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

    const nextTeamCount = updateActivityDto.teamCount;
    const nextTeamNames = updateActivityDto.teamNames;

    const updateData: any = {
      ...updateActivityDto,
      date: updateActivityDto.date ? new Date(updateActivityDto.date) : undefined,
    };

    // Normalize teamCount/teamNames if provided
    if (nextTeamCount !== undefined || nextTeamNames !== undefined) {
      const base = await this.prisma.activity.findUnique({ where: { id } });
      const teamCount = nextTeamCount ?? base?.teamCount ?? 2;
      const rawNames = (nextTeamNames ?? base?.teamNames ?? []).slice(0, 4);
      updateData.teamCount = teamCount;
      updateData.teamNames = Array.from({ length: teamCount }, (_, i) => {
        const raw = rawNames[i];
        return (raw || '').trim() || `队伍${i + 1}`;
      });

      // Keep formations aligned with teamCount
      const rawFormations = (base?.teamFormations ?? []).slice(0, 4);
      updateData.teamFormations = Array.from({ length: teamCount }, (_, i) => {
        const f = (rawFormations[i] || '').trim();
        return f || '4-4-2';
      });
    }

    const updatedActivity = await this.prisma.activity.update({
      where: { id },
      data: updateData,
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

  async getTeams(activityId: string, userId: string) {
    const activity = await this.findOne(activityId, userId);
    const canEdit = await this.canEditActivityTeams(activityId, userId);

    const teamCount = activity.teamCount ?? 2;
    const baseNames = (activity.teamNames || []).slice(0, 4);
    const teamNames = Array.from({ length: teamCount }, (_, i) => {
      const raw = baseNames[i];
      return (raw || '').trim() || `队伍${i + 1}`;
    });

    const baseFormations = (activity.teamFormations || []).slice(0, 4);
    const teamFormations = Array.from({ length: teamCount }, (_, i) => {
      const raw = baseFormations[i];
      return (raw || '').trim() || '4-4-2';
    });

    // If this activity belongs to a team, fetch jersey numbers
    const numbersByUserId = new Map<string, number>();
    if (activity.teamId) {
      const members = await this.prisma.teamMember.findMany({
        where: { teamId: activity.teamId, userId: { in: activity.attendances.map((a) => a.userId) } },
        select: { userId: true, number: true },
      });
      for (const m of members) {
        if (m.number !== null && m.number !== undefined) numbersByUserId.set(m.userId, m.number);
      }
    }

    const roster = (activity.attendances || []).map((a: any) => ({
      attendanceId: a.id,
      userId: a.userId,
      username: a.user?.username,
      avatarUrl: a.user?.avatarUrl || null,
      status: a.status,
      teamNo: a.teamNo ?? 0,
      slotNo: a.slotNo ?? 0,
      number: numbersByUserId.get(a.userId) ?? null,
    }));

    return {
      activityId,
      teamCount,
      teamNames,
      teamFormations,
      canEdit,
      roster,
    };
  }

  async updateTeams(activityId: string, userId: string, dto: UpdateActivityTeamsDto) {
    const canEdit = await this.canEditActivityTeams(activityId, userId);
    if (!canEdit) throw new ForbiddenException('您没有权限修改分队');

    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, teamCount: true, teamFormations: true },
    });
    if (!activity) throw new NotFoundException('活动不存在');

    const maxTeamNo = activity.teamCount ?? 2;
    const assignments = (dto.assignments || []).map((a) => ({
      attendanceId: a.attendanceId,
      teamNo: a.teamNo,
      slotNo: a.slotNo ?? undefined,
    }));

    for (const a of assignments) {
      if (a.teamNo < 0 || a.teamNo > maxTeamNo) {
        throw new ForbiddenException(`teamNo 必须在 0..${maxTeamNo} 范围内`);
      }
      if (a.slotNo !== undefined && (a.slotNo < 0 || a.slotNo > 99)) {
        throw new ForbiddenException('slotNo 必须在 0..99 范围内');
      }
      // 未分队时，强制清空槽位
      if (a.teamNo === 0) a.slotNo = 0;
    }

    // formation update (optional)
    if (dto.formations) {
      const raw = (dto.formations || []).slice(0, 4);
      const next = Array.from({ length: maxTeamNo }, (_, i) => {
        const f = (raw[i] || '').trim();
        return f || '4-4-2';
      });
      await this.prisma.activity.update({
        where: { id: activityId },
        data: { teamFormations: next },
      });
    }

    await this.prisma.$transaction(
      assignments.map((a) =>
        this.prisma.attendance.update({
          where: { id: a.attendanceId },
          data: { teamNo: a.teamNo, slotNo: a.slotNo ?? undefined },
        }),
      ),
    );

    return { message: '分队/站位已保存' };
  }
}
