/**
 * 清空所有用户，每个角色只保留一个账号；并清空头像（User.avatarUrl 及上传文件）
 * 运行: npx ts-node -r tsconfig-paths/register prisma/reset-users.ts
 * 或: npm run prisma:reset-users
 *
 * 保留账号（密码均为 123456）：
 *   super_admin: super_admin / super_admin@test.com
 *   admin:       admin / admin@test.com
 *   user:        user / user@test.com
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const PASSWORD = '123456';

/** 清空头像文件：删除 public/uploads/avatars 下所有文件 */
function clearAvatarFiles() {
  const avatarsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
  if (!fs.existsSync(avatarsDir)) return;
  const files = fs.readdirSync(avatarsDir);
  let count = 0;
  for (const f of files) {
    const fp = path.join(avatarsDir, f);
    if (fs.statSync(fp).isFile()) {
      fs.unlinkSync(fp);
      count++;
    }
  }
  if (count > 0) console.log(`已删除头像目录下 ${count} 个文件。`);
}

async function main() {
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  // 0. 清空头像：所有用户 avatarUrl 置空，并删除上传的头像文件
  const updated = await prisma.user.updateMany({ data: { avatarUrl: null } });
  console.log(`已清空 ${updated.count} 个用户的头像字段。`);
  clearAvatarFiles();

  // 1. 删除所有用户（会级联删除 Attendance；Activity 的 createdBy 会级联删除）
  const deleted = await prisma.user.deleteMany({});
  console.log(`已删除 ${deleted.count} 个用户。`);

  // 2. 每个角色各创建一个账号（头像字段不填，即为空）
  await prisma.user.createMany({
    data: [
      {
        email: 'super_admin@test.com',
        username: 'super_admin',
        password: hashedPassword,
        role: 'super_admin',
        avatarUrl: null,
      },
      {
        email: 'admin@test.com',
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        avatarUrl: null,
      },
      {
        email: 'user@test.com',
        username: 'user',
        password: hashedPassword,
        role: 'user',
        avatarUrl: null,
      },
    ],
  });

  console.log('已创建 3 个账号（每个角色一个）:');
  console.log('  super_admin  super_admin@test.com  密码: ' + PASSWORD);
  console.log('  admin        admin@test.com        密码: ' + PASSWORD);
  console.log('  user         user@test.com         密码: ' + PASSWORD);
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
