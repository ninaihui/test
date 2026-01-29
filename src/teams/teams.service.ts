import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { assertTeamAdmin, assertTeamMember } from './teams.auth';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createTeamDto: CreateTeamDto) {
    const team = await this.prisma.team.create({
      data: {
        name: createTeamDto.name,
        description: createTeamDto.description,
        adminUserId: userId,
        members: {
          create: {
            userId,
            role: 'captain', // 兼容旧语义：队长
          },
        },
      },
      include: {
        admin: {
          select: { id: true, username: true, email: true, avatarUrl: true },
        },
        members: {
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

    return team;
  }

  async findAll(userId: string) {
    const teams = await this.prisma.team.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        admin: {
          select: { id: true, username: true, avatarUrl: true },
        },
        members: {
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
        _count: {
          select: {
            members: true,
            activities: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return teams;
  }

  async findOne(id: string, userId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        admin: {
          select: { id: true, username: true, avatarUrl: true },
        },
        members: {
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
        activities: {
          take: 5,
          orderBy: {
            date: 'desc',
          },
        },
        _count: {
          select: {
            members: true,
            activities: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('球队不存在');
    }

    // 检查用户是否是球队成员
    await assertTeamMember(this.prisma, id, userId);

    return team;
  }

  async update(id: string, userId: string, updateTeamDto: UpdateTeamDto) {
    // 新规则：只有球队管理员可以修改球队信息
    await assertTeamAdmin(this.prisma, id, userId);

    const updatedTeam = await this.prisma.team.update({
      where: { id },
      data: updateTeamDto,
      include: {
        admin: { select: { id: true, username: true, avatarUrl: true } },
        members: {
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

    return updatedTeam;
  }

  async remove(id: string, userId: string) {
    // 新规则：只有球队管理员可以删除球队
    await assertTeamAdmin(this.prisma, id, userId);

    await this.prisma.team.delete({
      where: { id },
    });

    return { message: '球队已删除' };
  }

  async addMember(teamId: string, userId: string, addMemberDto: AddMemberDto) {
    // 新规则：只有球队管理员可以添加成员
    await assertTeamAdmin(this.prisma, teamId, userId);

    // 检查成员是否已存在
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: addMemberDto.userId,
          teamId,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('该用户已经是球队成员');
    }

    // 号码冲突（球队内唯一）
    if (addMemberDto.number != null) {
      const numberTaken = await this.prisma.teamMember.findFirst({
        where: { teamId, number: addMemberDto.number },
        select: { id: true },
      });
      if (numberTaken) throw new ConflictException('该号码已被占用');
    }

    const newMember = await this.prisma.teamMember.create({
      data: {
        userId: addMemberDto.userId,
        teamId,
        role: addMemberDto.role || 'member',
        number: addMemberDto.number,
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
      },
    });

    return newMember;
  }

  async removeMember(teamId: string, userId: string, memberId: string) {
    // 新规则：只有球队管理员可以移除成员
    await assertTeamAdmin(this.prisma, teamId, userId);

    await this.prisma.teamMember.delete({
      where: {
        userId_teamId: {
          userId: memberId,
          teamId,
        },
      },
    });

    return { message: '成员已移除' };
  }

  async assignNumber(teamId: string, adminUserId: string, memberUserId: string, number: number) {
    await assertTeamAdmin(this.prisma, teamId, adminUserId);

    // ensure member exists
    await assertTeamMember(this.prisma, teamId, memberUserId);

    const taken = await this.prisma.teamMember.findFirst({
      where: { teamId, number },
      select: { userId: true },
    });
    if (taken && taken.userId !== memberUserId) {
      throw new ConflictException('该号码已被占用');
    }

    return this.prisma.teamMember.update({
      where: { userId_teamId: { userId: memberUserId, teamId } },
      data: { number },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }

  async roster(teamId: string, userId: string) {
    await assertTeamMember(this.prisma, teamId, userId);

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, adminUserId: true },
    });
    if (!team) throw new NotFoundException('球队不存在');

    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      orderBy: [{ number: 'asc' }, { joinedAt: 'asc' }],
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      team,
      members,
      canManage: team.adminUserId === userId,
    };
  }

  async transferAdmin(teamId: string, currentAdminId: string, nextAdminUserId: string) {
    await assertTeamAdmin(this.prisma, teamId, currentAdminId);
    await assertTeamMember(this.prisma, teamId, nextAdminUserId);

    return this.prisma.team.update({
      where: { id: teamId },
      data: { adminUserId: nextAdminUserId },
      select: {
        id: true,
        name: true,
        adminUserId: true,
      },
    });
  }
}
