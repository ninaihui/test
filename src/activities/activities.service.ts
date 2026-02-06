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
import { normalizeEditorUserIds } from './activities.editors';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, userRole: string | undefined, createActivityDto: CreateActivityDto) {
    // Permission: system admin OR captain
    const isSystemAdmin = userRole === 'admin' || userRole === 'super_admin';
    if (!isSystemAdmin) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { isCaptain: true } });
      if (!u || !u.isCaptain) {
        throw new ForbiddenException('只有网站管理员或队长可以创建活动');
      }
    }

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

  async findOne(id: string, userId: string, userRole?: string) {
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

    const isSystemAdmin = userRole === 'admin' || userRole === 'super_admin';
    const editorsRaw = (activity as any).editorUserIds;
    const editors = Array.isArray(editorsRaw) ? editorsRaw : [];
    const canEdit = isSystemAdmin || activity.createdById === userId || editors.includes(userId);

    const maxParticipants = activity.maxParticipants != null && activity.maxParticipants >= 1 ? activity.maxParticipants : 14;
    const canLineup = maxParticipants >= 8;

    return { ...activity, canEdit, canLineup } as any;
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
        // do not allow editing editorUserIds via this endpoint
        editorUserIds: undefined,
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
      // Position conflicts are checked within the same team only.
      // If team is unassigned (teamNo=null), do not enforce position conflict.
      const tn = teamNo != null ? Number(teamNo) : 0;
      const normalizedTeamNoForPosition = Number.isFinite(tn) && tn > 0 ? tn : null;
      if (normalizedTeamNoForPosition != null) {
        const samePosition = await this.prisma.attendance.findFirst({
          where: {
            activityId,
            position: pos,
            teamNo: normalizedTeamNoForPosition,
            status: { in: ['registered', 'present', 'late'] },
          },
        });
        if (samePosition) {
          throw new ConflictException('该队该位置已有人，请换个位置');
        }
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

    // 取消报名后：
    // 1) 若有候补，按时间顺序递补为已报名
    // 2) 若退出者属于某个队伍，则从“未定”中按报名时间顺序自动补位到该队（不含候补）
    await this.prisma.$transaction(async (tx) => {
      await tx.attendance.delete({
        where: {
          userId_activityId: {
            userId,
            activityId,
          },
        },
      });

      const wasRegistered = attendance.status === 'registered' || attendance.status === 'present' || attendance.status === 'late';

      if (wasRegistered) {
        const nextWaitlist = await tx.attendance.findFirst({
          where: { activityId, status: 'waitlist' },
          orderBy: { createdAt: 'asc' },
        });
        if (nextWaitlist) {
          await tx.attendance.update({
            where: { id: nextWaitlist.id },
            data: { status: 'registered', position: null, teamNo: null },
          });
        }
      }

      // Auto-fill team vacancy from unassigned (teamNo=null) registered participants
      const teamNo = attendance.teamNo;
      if (wasRegistered && teamNo != null) {
        const maxParticipants = activity.maxParticipants != null && activity.maxParticipants >= 1 ? activity.maxParticipants : 14;
        const teamCount = (activity as any).teamCount != null ? Number((activity as any).teamCount) : 2;
        const teamCap = Math.ceil(maxParticipants / (teamCount || 1));

        // current team size
        const currentTeamSize = await tx.attendance.count({
          where: {
            activityId,
            status: { in: ['registered', 'present', 'late'] },
            teamNo,
          },
        });

        let need = teamCap - currentTeamSize;
        if (need > 0) {
          const candidates = await tx.attendance.findMany({
            where: {
              activityId,
              status: { in: ['registered', 'present', 'late'] },
              teamNo: null,
            },
            orderBy: { createdAt: 'asc' },
            select: { id: true, position: true },
          });

          for (const c of candidates) {
            if (need <= 0) break;
            const pos = c.position ? String(c.position).trim() : '';
            if (pos) {
              const conflict = await tx.attendance.findFirst({
                where: {
                  activityId,
                  status: { in: ['registered', 'present', 'late'] },
                  teamNo,
                  position: pos,
                },
                select: { id: true },
              });
              if (conflict) continue;
            }

            await tx.attendance.update({
              where: { id: c.id },
              data: { teamNo },
            });
            need--;
          }
        }
      }
    });

    return { message: '已取消报名' };
  }

  /** 保存本活动的出场位置（更新各报名记录的 position）。系统管理员 / 活动创建者 / 活动协管可编辑 */
  async updatePositions(
    activityId: string,
    currentUserId: string,
    currentUserRole: string,
    positions: { userId: string; position: string }[],
  ) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
    });
    if (!activity) {
      throw new NotFoundException('活动不存在');
    }
    const isSystemAdmin = currentUserRole === 'admin' || currentUserRole === 'super_admin';
    const editorsRaw = (activity as any).editorUserIds;
    const editors = Array.isArray(editorsRaw) ? editorsRaw : [];
    const canEdit = isSystemAdmin || activity.createdById === currentUserId || editors.includes(currentUserId);
    if (!canEdit) throw new ForbiddenException('无权限保存出场位置');

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

  /** 获取阵容（A/B：formation + slots）。若旧数据存在（attendance.position 编码），会自动迁移到新表。 */
  async getLineup(activityId: string, currentUserId: string, currentUserRole?: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('活动不存在');

    const isSystemAdmin = currentUserRole === 'admin' || currentUserRole === 'super_admin';
    const editorsRaw = (activity as any).editorUserIds;
    const editors = Array.isArray(editorsRaw) ? editorsRaw : [];
    const canEdit = isSystemAdmin || activity.createdById === currentUserId || editors.includes(currentUserId);

    let lineup = await this.prisma.activityLineup.findUnique({
      where: { activityId },
      include: { slots: true },
    });

    // Auto-migrate old encoded lineup stored in Attendance.position: "A:GK" / "B:ST1" ...
    if (!lineup) {
      const rows = await this.prisma.attendance.findMany({
        where: { activityId, status: { in: ['registered', 'present', 'late'] } },
        select: { userId: true, position: true },
      });
      const encoded = rows
        .map((r) => ({ userId: r.userId, pos: (r.position || '').trim() }))
        .filter((x) => /^([AB]):([A-Z0-9]+)$/.test(x.pos));

      if (encoded.length) {
        lineup = await this.prisma.activityLineup.create({
          data: {
            activityId,
            formationA: '4-4-2',
            formationB: '4-4-2',
            slots: {
              create: encoded.map((x) => {
                const m = x.pos.match(/^([AB]):([A-Z0-9]+)$/)!;
                return {
                  activityId,
                  teamKey: m[1],
                  slotKey: m[2],
                  userId: x.userId,
                };
              }),
            },
          },
          include: { slots: true },
        });
      }
    }

    if (!lineup) {
      lineup = await this.prisma.activityLineup.create({
        data: { activityId, formationA: '4-4-2', formationB: '4-4-2' },
        include: { slots: true },
      });
    }

    const teamNamesRaw = (activity as any).teamNames;
    const teamNames = Array.isArray(teamNamesRaw) ? teamNamesRaw : [];

    const maxParticipants = activity.maxParticipants != null && activity.maxParticipants >= 1 ? activity.maxParticipants : 14;
    const canLineup = maxParticipants >= 8;

    if (!canLineup) {
      return {
        activityId,
        canEdit: false,
        canLineup: false,
        teamNames,
        formation: { A: '4-4-2', B: '4-4-2' },
        slots: [],
        message: '活动人数上限低于 8：不会展示阵容，也无需管理位置',
      } as any;
    }

    const teamCount = (activity as any).teamCount != null ? Number((activity as any).teamCount) : 2;
    const tc = Number.isFinite(teamCount) && teamCount >= 1 ? Math.min(4, Math.max(1, teamCount)) : 2;

    const formationsRaw = (lineup as any).formations;
    const formations = formationsRaw && typeof formationsRaw === 'object' ? formationsRaw : {};

    // Backward compat: map A/B -> 1/2
    const formationByTeam: Record<string, string> = {};
    for (let i = 1; i <= tc; i++) {
      const k = String(i);
      const v = (formations as any)[k];
      if (typeof v === 'string' && v.trim()) formationByTeam[k] = v.trim();
    }
    if (!formationByTeam['1']) formationByTeam['1'] = lineup.formationA || '4-4-2';
    if (!formationByTeam['2']) formationByTeam['2'] = lineup.formationB || '4-4-2';

    const slots = lineup.slots.map((s) => {
      let tk = String(s.teamKey || '').trim();
      if (tk === 'A') tk = '1';
      if (tk === 'B') tk = '2';
      return { teamKey: tk, slotKey: s.slotKey, userId: s.userId };
    });

    return {
      activityId,
      canEdit,
      canLineup: true,
      teamCount: tc,
      teamNames,
      formation: formationByTeam,
      slots,
    } as any;
  }

  /** 保存阵容（A/B：formation + slots）。系统管理员 / 活动创建者 / 活动协管可编辑 */
  async updateLineup(
    activityId: string,
    currentUserId: string,
    currentUserRole: string,
    dto: { teamKey: 'A' | 'B'; formation?: string; slots: { slotKey: string; userId: string }[] },
  ) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('活动不存在');

    const maxParticipants = activity.maxParticipants != null && activity.maxParticipants >= 1 ? activity.maxParticipants : 14;
    if (maxParticipants < 8) {
      throw new BadRequestException('活动人数上限低于 8：不会展示阵容，也无需管理位置');
    }

    const isSystemAdmin = currentUserRole === 'admin' || currentUserRole === 'super_admin';
    const editorsRaw = (activity as any).editorUserIds;
    const editors = Array.isArray(editorsRaw) ? editorsRaw : [];
    const canEdit = isSystemAdmin || activity.createdById === currentUserId || editors.includes(currentUserId);
    if (!canEdit) throw new ForbiddenException('无权限保存阵容');

    let teamKey: string = String(dto.teamKey || '').trim();
    if (teamKey === 'A') teamKey = '1';
    if (teamKey === 'B') teamKey = '2';
    const slots = Array.isArray(dto.slots) ? dto.slots : [];

    const teamCount = (activity as any).teamCount != null ? Number((activity as any).teamCount) : 2;
    const tc = Number.isFinite(teamCount) && teamCount >= 1 ? Math.min(4, Math.max(1, teamCount)) : 2;
    const tn = Number(teamKey);
    if (!Number.isFinite(tn) || tn < 1 || tn > tc) {
      throw new BadRequestException('队伍不合法');
    }

    // Validate: no duplicates
    const slotKeys = new Set<string>();
    const userIds = new Set<string>();
    for (const s of slots) {
      const sk = String(s.slotKey || '').trim();
      const uid = String(s.userId || '').trim();
      if (!sk || !uid) continue;
      if (slotKeys.has(sk)) throw new BadRequestException('同一位置不能重复分配');
      if (userIds.has(uid)) throw new BadRequestException('同一队员不能重复分配');
      slotKeys.add(sk);
      userIds.add(uid);
    }

    // Ensure users belong to this activity (registered/present/late)
    const attendanceRows = await this.prisma.attendance.findMany({
      where: {
        activityId,
        status: { in: ['registered', 'present', 'late'] },
        userId: { in: Array.from(userIds) },
      },
      select: { userId: true },
    });
    const okUserIds = new Set(attendanceRows.map((r) => r.userId));
    for (const uid of userIds) {
      if (!okUserIds.has(uid)) throw new BadRequestException('阵容中包含未报名用户');
    }

    const formation = (dto.formation || '').trim();

    const lineup = await this.prisma.activityLineup.upsert({
      where: { activityId },
      create: {
        activityId,
        // keep defaults for backward compat
        formationA: teamKey === '1' && formation ? formation : '4-4-2',
        formationB: teamKey === '2' && formation ? formation : '4-4-2',
        formations: formation ? ({ [teamKey]: formation } as any) : undefined,
      },
      update: {
        formationA: teamKey === '1' && formation ? formation : undefined,
        formationB: teamKey === '2' && formation ? formation : undefined,
        formations: formation
          ? ({
              ...(((await this.prisma.activityLineup.findUnique({ where: { activityId }, select: { formations: true } })) as any)?.formations || {}),
              [teamKey]: formation,
            } as any)
          : undefined,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.activityLineupSlot.deleteMany({ where: { lineupId: lineup.id, teamKey } });
      const createData = slots
        .map((s) => ({ slotKey: String(s.slotKey || '').trim(), userId: String(s.userId || '').trim() }))
        .filter((s) => s.slotKey && s.userId)
        .map((s) => ({
          lineupId: lineup.id,
          activityId,
          teamKey,
          slotKey: s.slotKey,
          userId: s.userId,
        }));
      if (createData.length) {
        await tx.activityLineupSlot.createMany({ data: createData });
      }
    });

    return { message: '阵容已保存' };
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
    const editorsRaw = (activity as any).editorUserIds;
    const editors = Array.isArray(editorsRaw) ? editorsRaw : [];
    const canEdit = isSystemAdmin || activity.createdById === currentUserId || editors.includes(currentUserId);

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
    const editorsRaw = (activity as any).editorUserIds;
    const editors = Array.isArray(editorsRaw) ? editorsRaw : [];
    const canEdit = isSystemAdmin || activity.createdById === currentUserId || editors.includes(currentUserId);
    if (!canEdit) {
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

  /** 异常通道：网站管理员 或 活动创建者（队长）可设置本活动额外可编辑者 userId 列表 */
  async updateEditors(activityId: string, currentUserId: string, currentUserRole: string | undefined, editorUserIds: string[]) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('活动不存在');

    const isSystemAdmin = currentUserRole === 'admin' || currentUserRole === 'super_admin';
    if (!isSystemAdmin && activity.createdById !== currentUserId) {
      throw new ForbiddenException('无权限设置协管');
    }

    const normalized = normalizeEditorUserIds(editorUserIds || []);
    await this.prisma.activity.update({
      where: { id: activityId },
      data: { editorUserIds: normalized },
    });

    return { activityId, editorUserIds: normalized };
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
