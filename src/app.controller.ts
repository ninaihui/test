import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import * as fs from 'fs';

// 编译后文件在 dist/src/，需上两级到项目根再找 public
const PUBLIC_DIR = join(__dirname, '..', '..', 'public');
const DEBUG_LOG_PATH = join(process.cwd(), 'public', 'debug.log');

@Controller()
export class AppController {
  @Get()
  getHello(@Res() res: Response) {
    // Root path serves the public showcase page (展示页)
    return res.redirect('/showcase.html');
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

  /** 调试用：前端 POST 日志，写入 public/debug.log（NDJSON） */
  @Post('api/debug-log')
  debugLog(@Body() body: Record<string, unknown>) {
    try {
      const dir = join(process.cwd(), 'public');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(DEBUG_LOG_PATH, JSON.stringify(body) + '\n');
    } catch (e) {
      console.error('debug-log write failed', e);
    }
    return { ok: true };
  }
}
