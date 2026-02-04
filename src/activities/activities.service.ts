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
import { UpdateTeamsDto } from './dto/update-teams.dto';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createActivityDto: CreateActivityDto) {
    let maxParticipants = createActivityDto.maxParticipants != null ? createActivityDto.maxParticipants : 14;
    if (maxParticipants < 1) maxParticipants = 1;
    if (maxParticipants > 40) maxParticipants = 40;

    // Default teamCount = clamp(ceil(maxParticipants/12), 1, 4)
    let teamCount = createActivityDto.teamCount != null ? Number(createActivityDto.teamCount) : Math.ceil(maxParticipants / 12);
    if (!Number.isFinite(teamCount) || teamCount < 1) teamCount = 1;
    if (teamCount > 4) teamCount = 4;

    const defaultTeamNamesByCount: Record<number, string[]> = {
      1: ['队伍'],
      2: ['红队', '蓝队'],
      3: ['红队', '蓝队', '紫队'],
      4: ['红队', '蓝队', '紫队', '黄队'],
    };
    let teamNames = (createActivityDto.teamNames || []).map((s) => String(s || '').trim()).filter(Boolean);
    const defaults = defaultTeamNamesByCount[teamCount] || defaultTeamNamesByCount[2];
    // Pad/trim
    if (teamNames.length < teamCount) {
      for (const d of defaults) {
        if (teamNames.length >= teamCount) break;
        if (!teamNames.includes(d)) teamNames.push(d);
      }
      while (teamNames.length < teamCount) teamNames.push('队伍' + (teamNames.length + 1));
    }
    if (teamNames.length > teamCount) teamNames = teamNames.slice(0, teamCount);

    const deadlineAt = createActivityDto.deadlineAt ? new Date(createActivityDto.deadlineAt) : null;
    const activityDate = new Date(createActivityDto.date);
    if (deadlineAt && Number.isFinite(deadlineAt.getTime()) && deadlineAt.getTime() > activityDate.getTime()) {
      throw new BadRequestException('报名截止时间不能晚于活动开始时间');
    }

    const activity = await this.prisma.activity.create({
      data: {
        name: createActivityDto.name,
        description: createActivityDto.description,
        date: activityDate,
        deadlineAt,
        location: createActivityDto.location,
        venueId: createActivityDto.venueId,
        maxParticipants,
        teamCount,
        teamNames,
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
        // 轻量带上状态以便前端展示“已报名/候补”计数
        attendances: {
          select: { status: true, userId: true },
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

    return activities.map((a) => {
      const registeredCount = (a.attendances || []).filter(
        (r) => r.status === 'registered' || r.status === 'present' || r.status === 'late',
      ).length;
      const waitlistCount = (a.attendances || []).filter((r) => r.status === 'waitlist').length;
      return {
        ...a,
        registeredCount,
        waitlistCount,
        isRegisteredByCurrentUser: myAttendanceActivityIds.has(a.id),
      };
    });
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
          orderBy: { createdAt: 'asc' },
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
  async register(activityId: string, userId: string, position?: string, teamNo?: number) {
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
        where: { activityId, position: pos, status: { in: ['registered', 'present', 'late'] } },
      });
      if (samePosition) {
        throw new ConflictException('位置重复了，请换个位置');
      }
    }

    // NOTE: per product decision (2026-02-03): even if deadlineAt is reached, still allow new registrations.

    const maxParticipants = activity.maxParticipants != null && activity.maxParticipants >= 1 ? activity.maxParticipants : 14;
    const registeredCount = await this.prisma.attendance.count({
      where: {
        activityId,
        status: { in: ['registered', 'present', 'late'] },
      },
    });

    const willWaitlist = registeredCount >= maxParticipants;

    // Team assignment (only for registered participants; waitlist does not participate)
    const teamCount = (activity as any).teamCount != null ? Number((activity as any).teamCount) : 2;
    const teamCap = Math.ceil(maxParticipants / (teamCount || 1));
    let normalizedTeamNo: number | null = null;
    if (!willWaitlist) {
      const tn = teamNo != null ? Number(teamNo) : 0;
      if (!Number.isFinite(tn) || tn < 0) {
        throw new BadRequestException('队伍选择不合法');
      }
      if (tn === 0) normalizedTeamNo = null;
      else {
        if (tn > teamCount) throw new BadRequestException('队伍选择不合法');
        const teamUsed = await this.prisma.attendance.count({
          where: {
            activityId,
            status: { in: ['registered', 'present', 'late'] },
            teamNo: tn,
          },
        });
        if (teamUsed >= teamCap) {
          throw new ConflictException('该队已满，请选择其他队或未定');
        }
        normalizedTeamNo = tn;
      }
    }

    const attendance = await this.prisma.attendance.create({
      data: {
        userId,
        activityId,
        status: willWaitlist ? 'waitlist' : 'registered',
        // 候补不占用位置槽位，避免位置冲突
        position: willWaitlist ? undefined : (pos || undefined),
        // 候补不参与分队
        teamNo: willWaitlist ? null : normalizedTeamNo,
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

    // 取消报名后，如果有人在候补队列，则按时间顺序自动递补
    await this.prisma.$transaction(async (tx) => {
      await tx.attendance.delete({
        where: {
          userId_activityId: {
            userId,
            activityId,
          },
        },
      });

      if (attendance.status === 'registered' || attendance.status === 'present' || attendance.status === 'late') {
        const nextWaitlist = await tx.attendance.findFirst({
          where: { activityId, status: 'waitlist' },
          orderBy: { createdAt: 'asc' },
        });
        if (nextWaitlist) {
          await tx.attendance.update({
            where: { id: nextWaitlist.id },
            data: { status: 'registered', position: null },
          });
        }
      }
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

  /** 获取已报名用户的分队信息（候补不包含）；非管理员只读 */
  async getTeams(activityId: string, currentUserId: string, currentUserRole?: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('活动不存在');

    const isSystemAdmin = currentUserRole === 'admin' || currentUserRole === 'super_admin';
    const canEdit = isSystemAdmin || activity.createdById === currentUserId;

    const rows = await this.prisma.attendance.findMany({
      where: {
        activityId,
        status: { in: ['registered', 'present', 'late'] },
      },
      select: {
        userId: true,
        teamNo: true,
        updatedAt: true,
        user: { select: { id: true, username: true, avatarUrl: true, playingPosition: true } },
      },
      orderBy: [{ teamNo: 'asc' }, { updatedAt: 'desc' }],
    });

    const teamCount = (activity as any).teamCount || 2;
    const teamNamesRaw = (activity as any).teamNames;
    const teamNames = Array.isArray(teamNamesRaw) ? teamNamesRaw : [];

    return {
      activityId,
      teamCount,
      teamNames,
      canEdit,
      roster: rows.map((r) => ({
        userId: r.userId,
        teamNo: r.teamNo,
        user: r.user,
      })),
    };
  }

  /** 批量更新已报名用户的分队（teamNo）。teamNo 为空则清除分队 */
  async updateTeams(activityId: string, currentUserId: string, currentUserRole: string | undefined, dto: UpdateTeamsDto) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('活动不存在');

    const isSystemAdmin = currentUserRole === 'admin' || currentUserRole === 'super_admin';
    if (activity.createdById !== currentUserId && !isSystemAdmin) {
      throw new ForbiddenException('无权限修改分队');
    }

    const teamCount = (activity as any).teamCount || 2;

    const assignments = (dto && dto.assignments) || [];
    if (!assignments.length) throw new BadRequestException('assignments 不能为空');

    await this.prisma.$transaction(async (tx) => {
      for (const a of assignments) {
        const att = await tx.attendance.findUnique({
          where: { userId_activityId: { userId: a.userId, activityId } },
          select: { id: true, status: true },
        });
        if (!att) continue;
        if (!['registered', 'present', 'late'].includes(att.status)) continue;

        const nextTeamNo = a.teamNo ?? null;
        if (nextTeamNo != null && (nextTeamNo < 1 || nextTeamNo > teamCount)) {
          continue;
        }

        await tx.attendance.update({
          where: { id: att.id },
          data: { teamNo: nextTeamNo },
        });
      }
    });

    return this.getTeams(activityId, currentUserId, currentUserRole);
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
