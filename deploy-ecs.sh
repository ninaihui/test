#!/bin/bash
# 业余球队管理系统 - 推送到阿里云 ECS 并部署
# 使用前：在下方填写 ECS 信息，并在本机配置好 SSH 免密（或 -i 指定密钥）

set -e

# ========== 请填写你的 ECS 信息 ==========
ECS_HOST="47.237.69.93"   # ECS 公网 IP
ECS_USER="root"       # SSH 登录用户名
ECS_APP_PATH="/opt/test"   # ECS 上项目所在目录
SSH_KEY=""            # 密码登录留空；密钥登录填: -i ~/.ssh/你的密钥.pem
# =========================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$ECS_HOST" ]; then
  echo -e "${RED}❌ 请先编辑 deploy-ecs.sh，填写 ECS_HOST（ECS 公网 IP 或域名）${NC}"
  exit 1
fi

SSH_OPTS="${SSH_KEY}"
RSYNC_EXCLUDE="--exclude=node_modules --exclude=dist --exclude=.env --exclude=.git --exclude=public/uploads --exclude=coverage --exclude=.nyc_output"

echo -e "${BLUE}📤 同步代码到 ECS ${ECS_USER}@${ECS_HOST}:${ECS_APP_PATH} ...${NC}"
echo -e "${YELLOW}   （含 public/assets 如 login-bg.png、profile-bg.png）${NC}"
rsync -avz --delete $RSYNC_EXCLUDE \
  -e "ssh $SSH_OPTS" \
  ./ "${ECS_USER}@${ECS_HOST}:${ECS_APP_PATH}/"

echo -e "${BLUE}🔨 在 ECS 上安装依赖并构建...${NC}"
# 注意：生产环境常用 NODE_ENV=production，会导致 devDependencies（含 prisma CLI）不安装，从而无法生成 Prisma Client。
# 这里强制安装 devDependencies，并显式执行 prisma generate。
ssh $SSH_OPTS "${ECS_USER}@${ECS_HOST}" "cd ${ECS_APP_PATH} && npm install --include=dev && npx prisma generate && npm run build"

echo -e "${GREEN}✅ 代码已推送并构建完成${NC}"
echo -e "${YELLOW}建议在 ECS 上用 ecs-fix-and-start.sh 方式重启（nohup 后台运行）：${NC}"
echo -e "  ssh ${SSH_OPTS} ${ECS_USER}@${ECS_HOST} 'cd ${ECS_APP_PATH} && bash ecs-fix-and-start.sh'"
