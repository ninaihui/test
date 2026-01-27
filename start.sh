#!/bin/bash

# 业余球队管理系统 - 启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 启动业余球队管理系统...${NC}"

# 切换到项目目录
cd "$(dirname "$0")"
PROJECT_DIR=$(pwd)

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装，请先安装 Node.js 20+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js 版本过低，需要 Node.js 20+，当前版本: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js 版本: $(node -v)${NC}"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm 未安装${NC}"
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 检测到未安装依赖，正在安装...${NC}"
    npm install
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件，正在从 .env.example 复制...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ .env 文件已创建，请检查配置${NC}"
    else
        echo -e "${RED}❌ 未找到 .env.example 文件${NC}"
        exit 1
    fi
fi

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker 未运行，请先启动 Docker Desktop${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker 已运行${NC}"

# 启动 PostgreSQL 数据库
echo -e "${BLUE}📦 启动 PostgreSQL 数据库...${NC}"
docker-compose up -d postgres 2>/dev/null || {
    echo -e "${YELLOW}⚠️  数据库容器可能已存在，继续...${NC}"
}

# 等待数据库就绪
echo -e "${BLUE}⏳ 等待数据库就绪...${NC}"
MAX_WAIT=30
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if docker exec team_management_db pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 数据库已就绪${NC}"
        break
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
        echo -e "${RED}❌ 数据库启动超时${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""

# 检查 Prisma Client 是否生成
if [ ! -d "generated/prisma" ]; then
    echo -e "${YELLOW}📦 生成 Prisma Client...${NC}"
    npm run prisma:generate
    echo -e "${GREEN}✅ Prisma Client 已生成${NC}"
fi

# 检查是否需要运行数据库迁移
echo -e "${BLUE}🔍 检查数据库迁移状态...${NC}"
MIGRATION_STATUS=$(npm run prisma:migrate status 2>&1 || echo "need_migration")

if echo "$MIGRATION_STATUS" | grep -q "Database schema is up to date"; then
    echo -e "${GREEN}✅ 数据库迁移已是最新${NC}"
else
    echo -e "${YELLOW}📝 检测到数据库需要迁移，正在运行迁移...${NC}"
    echo -e "${YELLOW}   如果提示输入迁移名称，请输入: add_teams_activities_attendance${NC}"
    npm run prisma:migrate || {
        echo -e "${YELLOW}⚠️  迁移可能需要交互，请手动运行: npm run prisma:migrate${NC}"
    }
fi

# 启动应用
echo -e "${BLUE}🎯 启动 NestJS 应用...${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}应用将在 http://localhost:3000 启动${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

npm run start:dev
