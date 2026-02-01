/**
 * 批量创建 15 个普通用户：user1 ～ user15，密码 111111
 * 运行: npx ts-node -r tsconfig-paths/register prisma/create-user1-15.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const PASSWORD = '111111';

async function main() {
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  const users = Array.from({ length: 15 }, (_, i) => {
    const n = i + 1;
    return {
      email: `user${n}@test.com`,
      username: `user${n}`,
      password: hashedPassword,
      role: 'user',
    };
  });

  let created = 0;
  for (const u of users) {
    try {
      await prisma.user.create({ data: u });
      created++;
      console.log('已创建:', u.username, u.email);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        console.log('已存在，跳过:', u.username, u.email);
      } else {
        throw e;
      }
    }
  }

  console.log(`\n完成。新创建 ${created} 个用户。`);
  console.log('账号: user1 ～ user15，密码: ' + PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
