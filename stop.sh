#!/bin/bash

# 业余球队管理系统 - 停止脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 停止业余球队管理系统...${NC}"

# 切换到项目目录
cd "$(dirname "$0")"

# 停止所有服务（生产 compose）
echo -e "${BLUE}📦 停止 Docker Compose 服务...${NC}"
docker compose -f docker-compose.prod.yml down

echo -e "${GREEN}✅ 已停止所有服务${NC}"
