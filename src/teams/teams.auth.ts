import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function assertTeamMember(prisma: PrismaService, teamId: string, userId: string) {
  const member = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  if (!member) throw new ForbiddenException('您不是该球队的成员');
  return member;
}

export async function assertTeamAdmin(prisma: PrismaService, teamId: string, userId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, adminUserId: true },
  });
  if (!team) throw new NotFoundException('球队不存在');
  if (!team.adminUserId) throw new ForbiddenException('球队未设置管理员');
  if (team.adminUserId !== userId) throw new ForbiddenException('只有球队管理员可以执行此操作');
  return team;
}
