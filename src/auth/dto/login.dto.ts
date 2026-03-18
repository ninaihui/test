import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: '用户名或邮箱必须是字符串' })
  @IsNotEmpty({ message: '用户名或邮箱不能为空' })
  @MaxLength(100, { message: '用户名或邮箱最多100个字符' })
  usernameOrEmail: string;

  @IsString({ message: '密码必须是字符串' })
  @IsNotEmpty({ message: '密码不能为空' })
  @MaxLength(100, { message: '密码最多100个字符' })
  password: string;
}
