import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('public')
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('activities')
  async listActivities(@Query('limit') limit?: string) {
    const take = Math.min(20, Math.max(1, Number(limit) || 6));
    const now = new Date();

    const rows = await this.prisma.activity.findMany({
      take,
      orderBy: { date: 'desc' },
      where: {
        // show recent + upcoming (simple rule)
        date: { gte: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 60) },
      },
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        maxParticipants: true,
        teamCount: true,
        teamNames: true,
        venue: { select: { name: true } },
      },
    });

    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      date: a.date,
      location: a.venue?.name || a.location,
      maxParticipants: a.maxParticipants,
      teamCount: a.teamCount,
      teamNames: a.teamNames,
    }));
  }
}
