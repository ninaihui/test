/**
 * 批量创建 100 个测试用户 + 3～4 个场地
 * 运行: npm run prisma:seed
 */
import { PrismaClient } from '../generated/prisma';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = '123456';

const VENUES = [
  { name: 'XX足球公园 A 场', address: null as string | null },
  { name: 'XX足球公园 B 场', address: null as string | null },
  { name: 'YY体育中心 1 号场', address: null as string | null },
  { name: 'ZZ社区足球场', address: null as string | null },
];

async function main() {
  // 场地：3～4 个（若已存在则跳过）
  const existingVenues = await prisma.venue.count();
  if (existingVenues === 0) {
    await prisma.venue.createMany({
      data: VENUES,
    });
    console.log(`已创建 ${VENUES.length} 个场地。`);
  } else {
    console.log(`场地已存在（${existingVenues} 个），跳过。`);
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const users = Array.from({ length: 100 }, (_, i) => {
    const n = i + 1;
    return {
      email: `user${n}@test.com`,
      username: `user${n}`,
      password: hashedPassword,
      role: 'user',
    };
  });

  const result = await prisma.user.createMany({
    data: users,
    skipDuplicates: true,
  });

  console.log(`已创建 ${result.count} 个用户。`);
  console.log(`邮箱: user1@test.com ... user100@test.com，密码: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
