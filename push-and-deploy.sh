#!/bin/bash
# 一键：推送到 GitHub + 部署到阿里云 ECS
# 用法：./push-and-deploy.sh [提交说明]
# 若不传提交说明且有未提交更改，会使用默认说明 "deploy: 更新"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BRANCH="${BRANCH:-main}"
COMMIT_MSG="${1:-deploy: 更新}"

# ---------- 1. 推送到 GitHub ----------
echo -e "${BLUE}📋 检查 Git 状态...${NC}"
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}有未提交更改，正在提交并推送${NC}"
  git add -A
  git commit -m "$COMMIT_MSG"
else
  echo -e "${GREEN}工作区干净，无需提交${NC}"
fi

echo -e "${BLUE}📤 推送到 GitHub (origin ${BRANCH})...${NC}"
if ! git push origin "$BRANCH"; then
  echo -e "${RED}❌ 推送失败。若远程有更新，请先执行: git pull origin ${BRANCH} --no-rebase${NC}"
  exit 1
fi
echo -e "${GREEN}✅ 已推送到 GitHub${NC}"

# ---------- 2. 部署到阿里云 ECS ----------
echo ""
echo -e "${BLUE}🚀 开始部署到 ECS...${NC}"
if [ ! -x "./deploy-ecs.sh" ]; then
  chmod +x ./deploy-ecs.sh
fi
./deploy-ecs.sh

echo ""
echo -e "${GREEN}✅ 全部完成：已推送 GitHub 并同步到 ECS${NC}"
echo -e "${YELLOW}若需重启应用，请在 ECS 上执行： cd /opt/test && npm run start:production & 或 pm2 restart 你的应用名${NC}"
