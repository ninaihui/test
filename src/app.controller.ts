import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';

@Controller()
export class AppController {
  @Get()
  getHello(@Res() res: Response) {
    // 返回首页 HTML 页面
    res.sendFile(join(__dirname, '..', 'public', 'index.html'));
  }

  @Get('login.html')
  getLogin(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'login.html'));
  }

  @Get('register.html')
  getRegister(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'register.html'));
  }

  @Get('dashboard.html')
  getDashboard(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'dashboard.html'));
  }

  // 管理员仪表板
  @Get('admin-dashboard.html')
  getAdminDashboard(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'admin-dashboard.html'));
  }

  // 普通用户仪表板
  @Get('user-dashboard.html')
  getUserDashboard(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'user-dashboard.html'));
  }

  @Get('teams.html')
  getTeams(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'teams.html'));
  }

  @Get('activities.html')
  getActivities(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'activities.html'));
  }

  @Get('attendance.html')
  getAttendance(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'attendance.html'));
  }

  @Get('profile.html')
  getProfile(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'profile.html'));
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
