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

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createTeamDto: CreateTeamDto) {
    const team = await this.prisma.team.create({
      data: {
        name: createTeamDto.name,
        description: createTeamDto.description,
        members: {
          create: {
            userId,
            role: 'captain', // 创建者默认为队长
          },
        },
      },
      include: {
        members: {
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
        members: {
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
        members: {
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
    const isMember = team.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('您不是该球队的成员');
    }

    return team;
  }

  async update(id: string, userId: string, updateTeamDto: UpdateTeamDto) {
    // 检查用户是否是队长或教练
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          where: {
            userId,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('球队不存在');
    }

    const member = team.members[0];
    if (!member || !['captain', 'coach'].includes(member.role)) {
      throw new ForbiddenException('只有队长或教练可以修改球队信息');
    }

    const updatedTeam = await this.prisma.team.update({
      where: { id },
      data: updateTeamDto,
      include: {
        members: {
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

    return updatedTeam;
  }

  async remove(id: string, userId: string) {
    // 检查用户是否是队长
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          where: {
            userId,
            role: 'captain',
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('球队不存在');
    }

    if (team.members.length === 0) {
      throw new ForbiddenException('只有队长可以删除球队');
    }

    await this.prisma.team.delete({
      where: { id },
    });

    return { message: '球队已删除' };
  }

  async addMember(teamId: string, userId: string, addMemberDto: AddMemberDto) {
    // 检查用户是否有权限添加成员
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: {
            userId,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('球队不存在');
    }

    const member = team.members[0];
    if (!member || !['captain', 'coach'].includes(member.role)) {
      throw new ForbiddenException('只有队长或教练可以添加成员');
    }

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

    const newMember = await this.prisma.teamMember.create({
      data: {
        userId: addMemberDto.userId,
        teamId,
        role: addMemberDto.role || 'member',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return newMember;
  }

  async removeMember(teamId: string, userId: string, memberId: string) {
    // 检查用户是否有权限移除成员
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: {
            userId,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('球队不存在');
    }

    const member = team.members[0];
    if (!member || !['captain', 'coach'].includes(member.role)) {
      throw new ForbiddenException('只有队长或教练可以移除成员');
    }

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
}
