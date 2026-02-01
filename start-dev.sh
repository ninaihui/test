#!/bin/bash
# 本地开发环境启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}本地开发启动${NC}"

if [ ! -f ".env" ]; then
  echo -e "${YELLOW}未找到 .env，从 .env.example 复制一份并请填写 DATABASE_URL、JWT_SECRET 等${NC}"
  [ -f ".env.example" ] && cp .env.example .env
fi

if [ ! -d "node_modules" ]; then
  echo -e "${BLUE}安装依赖...${NC}"
  npm install
fi

echo -e "${BLUE}生成 Prisma Client...${NC}"
npx prisma generate --schema=./prisma/schema.prisma

echo -e "${GREEN}启动开发服务（热重载）...${NC}"
echo -e "${YELLOW}访问 http://localhost:3000${NC}"
exec npm run start:dev
