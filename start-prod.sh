#!/bin/bash

# 业余球队管理系统 - 生产环境启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 启动业余球队管理系统（生产模式）...${NC}"

# 切换到项目目录
cd "$(dirname "$0")"

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ 未找到 .env 文件${NC}"
    exit 1
fi

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker 未运行，请先启动 Docker Desktop${NC}"
    exit 1
fi

# 启动 PostgreSQL 数据库
echo -e "${BLUE}📦 启动 PostgreSQL 数据库...${NC}"
docker-compose up -d postgres

# 等待数据库就绪
echo -e "${BLUE}⏳ 等待数据库就绪...${NC}"
for i in {1..30}; do
    if docker exec team_management_db pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 数据库已就绪${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ 数据库启动超时${NC}"
        exit 1
    fi
    sleep 1
done

# 构建项目
echo -e "${BLUE}🔨 构建项目...${NC}"
npm run build

# 启动应用
echo -e "${BLUE}🎯 启动 NestJS 应用（生产模式）...${NC}"
npm run start:prod
