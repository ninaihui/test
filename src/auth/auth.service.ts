import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private async createUserWithRole(registerDto: RegisterDto, role: string) {
    const { email, username, password } = registerDto;

    // 检查账号是否已存在（账号不限于邮箱格式）
    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUserByEmail) {
      throw new ConflictException('该账号已被注册');
    }

    // 检查用户名是否已存在
    const existingUserByUsername = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existingUserByUsername) {
      throw new ConflictException('该用户名已被使用');
    }

    // 对密码进行 hash
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 生成 JWT token
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    return {
      user,
      accessToken,
    };
  }

  // 普通注册接口：创建普通用户
  async register(registerDto: RegisterDto) {
    return this.createUserWithRole(registerDto, 'user');
  }

  // 由超级管理员调用：创建管理员
  async createAdmin(registerDto: RegisterDto) {
    return this.createUserWithRole(registerDto, 'admin');
  }

  // 由管理员 / 超级管理员调用：创建普通用户
  async createNormalUser(registerDto: RegisterDto) {
    return this.createUserWithRole(registerDto, 'user');
  }

  async login(loginDto: LoginDto) {
    const { usernameOrEmail, password } = loginDto;

    // 查找用户（通过邮箱或用户名）；只 select 所需字段，避免未迁移 playingPosition 时 500
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: usernameOrEmail },
          { username: usernameOrEmail },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户名/邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名/邮箱或密码错误');
    }

    // 生成 JWT token
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return user;
  }
}
