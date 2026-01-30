import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';

// 编译后文件在 dist/src/，需上两级到项目根再找 public
const PUBLIC_DIR = join(__dirname, '..', '..', 'public');

@Controller()
export class AppController {
  @Get()
  getHello(@Res() res: Response) {
    res.sendFile(join(PUBLIC_DIR, 'login.html'));
  }

  @Get('login.html')
  getLogin(@Res() res: Response) {
    res.sendFile(join(PUBLIC_DIR, 'login.html'));
  }

  @Get('register.html')
  getRegister(@Res() res: Response) {
    res.sendFile(join(PUBLIC_DIR, 'register.html'));
  }

  @Get('dashboard.html')
  getDashboard(@Res() res: Response) {
    res.sendFile(join(PUBLIC_DIR, 'dashboard.html'));
  }

  @Get('tactics.html')
  getTactics(@Res() res: Response) {
    res.sendFile(join(PUBLIC_DIR, 'tactics.html'));
  }

  @Get('admin-dashboard.html')
  getAdminDashboard(@Res() res: Response) {
    res.sendFile(join(PUBLIC_DIR, 'admin-dashboard.html'));
  }

  @Get('user-dashboard.html')
  getUserDashboard(@Res() res: Response) {
    res.sendFile(join(PUBLIC_DIR, 'user-dashboard.html'));
  }

  @Get('teams.html')
  getTeams(@Res() res: Response) {
    res.sendFile(join(PUBLIC_DIR, 'teams.html'));
  }

  @Get('activities.html')
  getActivities(@Res() res: Response) {
    res.sendFile(join(PUBLIC_DIR, 'activities.html'));
  }

  @Get('profile.html')
  getProfile(@Res() res: Response) {
    res.sendFile(join(PUBLIC_DIR, 'profile.html'));
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
