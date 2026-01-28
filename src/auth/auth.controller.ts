import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // 仅超级管理员可创建管理员账户
  @Post('create-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async createAdmin(@Body() registerDto: RegisterDto) {
    return this.authService.createAdmin(registerDto);
  }

  // 管理员 / 超级管理员可创建普通用户
  @Post('create-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async createNormalUser(@Body() registerDto: RegisterDto) {
    return this.authService.createNormalUser(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req) {
    return this.authService.validateUser(req.user.sub);
  }
}
