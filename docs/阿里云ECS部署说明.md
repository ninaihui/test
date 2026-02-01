# 阿里云 ECS 部署说明

## 1. 首次在 ECS 上准备环境

在 ECS 上执行（以 root 或有 sudo 的用户为例）：

```bash
# 安装 Node.js 20+（若未安装）
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
# 或 Ubuntu: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs

# 安装 Docker（用于 PostgreSQL）
curl -fsSL https://get.docker.com | sh
sudo systemctl start docker && sudo systemctl enable docker

# 创建项目目录
sudo mkdir -p /opt/team-app
sudo chown $USER:$USER /opt/team-app
```

把本地的 `.env` 和 `docker-compose.yml` 等配置拷到 ECS 的 `/opt/team-app`，并配置好 `DATABASE_URL` 等环境变量。

## 2. 配置本机到 ECS 的 SSH

- 在阿里云控制台为 ECS 绑定密钥对，或使用密码。
- 本机免密登录（推荐）：
  ```bash
  ssh-copy-id -i ~/.ssh/your_key.pem root@你的ECS公网IP
  ```
- 若使用密钥文件，在 `deploy-ecs.sh` 里设置：
  ```bash
  SSH_KEY="-i /path/to/your_ecs_key.pem"
  ```

## 3. 填写 deploy-ecs.sh 中的 ECS 信息

编辑项目根目录下的 `deploy-ecs.sh`：

```bash
ECS_HOST="你的ECS公网IP或域名"
ECS_USER="root"
ECS_APP_PATH="/opt/team-app"
SSH_KEY="-i ~/.ssh/your_ecs_key.pem"   # 不用密钥可留空
```

## 4. 执行推送与部署

在项目根目录执行：

```bash
chmod +x deploy-ecs.sh
./deploy-ecs.sh
```

脚本会：

1. 用 `rsync` 把代码同步到 ECS（排除 `node_modules`、`dist`、`.env`、`public/uploads` 等）。
2. SSH 到 ECS，在项目目录执行 `npm install` 和 `npm run build`。

构建完成后，需要在 ECS 上**手动重启应用**，例如：

```bash
ssh root@你的ECSIP 'cd /opt/team-app && npm run start:production &'
```

若使用 pm2：

```bash
ssh root@你的ECSIP 'cd /opt/team-app && pm2 restart team-app'
```

## 5. ECS 安全组

在阿里云控制台为 ECS 开放：

- 应用端口（如 3000），或 Nginx 反向代理用的 80/443。
- 22（SSH），仅建议限制为你的 IP。

## 6. 可选：Nginx 反向代理

若希望通过 80/443 访问，可在 ECS 上安装 Nginx，并配置反向代理到 `http://127.0.0.1:3000`。

## 7. 在 ECS 上从 GitHub 拉取代码并部署

若希望**直接在 ECS 上**从 GitHub 拉代码、构建并重启（不依赖本机 rsync），按下面做。

### 7.1 首次在 ECS 上克隆仓库

SSH 登录 ECS 后：

```bash
# 安装 Git（若未安装）
# CentOS/Alibaba Linux: sudo yum install -y git
# Ubuntu: sudo apt update && sudo apt install -y git

# 若用 HTTPS 克隆（需输入 GitHub 用户名/密码或 Personal Access Token）
sudo mkdir -p /opt/test
sudo chown $USER:$USER /opt/test
cd /opt/test
git clone https://github.com/你的用户名/你的仓库名.git .

# 若用 SSH 克隆（需先在 ECS 上配置 GitHub SSH 密钥）
# 生成密钥： ssh-keygen -t ed25519 -C "ecs-deploy" -f ~/.ssh/id_ed25519_github -N ""
# 把 ~/.ssh/id_ed25519_github.pub 内容加到 GitHub → Settings → SSH and GPG keys
# git clone git@github.com:你的用户名/你的仓库名.git .
```

配置环境变量（与本地一致）：

```bash
cd /opt/test
cp .env.example .env
vim .env   # 填写 DATABASE_URL、JWT_SECRET 等
```

安装依赖、构建、跑迁移并启动：

```bash
npm install
npm run build
npx prisma generate
npx prisma migrate deploy   # 按需，若数据库已在别处跑过可跳过
npm run start:production
# 或： nohup node dist/main.js > /tmp/team-app.log 2>&1 &
# 或： pm2 start dist/main.js --name team-app
```

### 7.2 之后每次更新（拉取 + 部署）

在 ECS 上执行，或从本机 SSH 过去执行：

```bash
cd /opt/test
git pull origin main          # 或你的默认分支名
npm install
npm run build
npx prisma migrate deploy    # 若有新迁移
npm run start:production
# 或： pm2 restart team-app
```

### 7.3 可选：写成一键部署脚本

在 ECS 的 `/opt/test/deploy-from-git.sh` 里写：

```bash
#!/bin/bash
set -e
cd /opt/test
git pull origin main
npm install
npm run build
npx prisma migrate deploy
npm run start:production
echo "部署完成"
```

然后：`chmod +x deploy-from-git.sh`，以后更新只需执行 `./deploy-from-git.sh`。

### 7.4 私有仓库注意

- **HTTPS**：需在 ECS 上配置 GitHub Personal Access Token，或 `git config credential.helper store` 后输入一次账号/Token。
- **SSH**：在 ECS 上生成密钥，把公钥加到 GitHub 仓库的 Deploy keys 或你的 SSH keys 中。

---

## 8. 将本地数据库同步到 ECS

若希望把**本地 PostgreSQL 的数据**完整同步到 ECS 上的数据库（覆盖 ECS 现有数据），在项目根目录执行：

```bash
chmod +x sync-db-to-ecs.sh
./sync-db-to-ecs.sh
```

**前提：**

1. 本机已安装 PostgreSQL 客户端（含 `pg_dump`），且 `.env` 中配置好本地 `DATABASE_URL`。
2. ECS 信息与 `deploy-ecs.sh` 一致（或设置环境变量 `ECS_HOST`、`ECS_USER`、`ECS_APP_PATH`、`SSH_KEY`）。
3. ECS 上项目目录已有 `.env`，且其中 `DATABASE_URL` 指向 ECS 上的 PostgreSQL（本机或 RDS）。
4. ECS 上已安装 PostgreSQL 客户端（含 `psql`）。若 ECS 只用 Docker 跑 Postgres、宿主机未装 `psql`，可先安装：
   - CentOS/Alibaba Linux: `sudo yum install -y postgresql15`
   - Ubuntu: `sudo apt install -y postgresql-client`

脚本会：导出本地库 → 上传 dump 到 ECS → 在 ECS 上用 `.env` 中的 `DATABASE_URL` 导入（会先执行 dump 中的 DROP，再重建表和数据）。同步完成后，本地会保留临时文件 `prisma/db-dump-ecs.sql`，无需可手动删除。

---

## 9. 502 Bad Gateway 排查

出现 502 说明 Nginx 收到了请求，但背后的 Node 应用没有正常响应。在 ECS 上按顺序做：

**① 看 Node 是否在跑、是否监听 3000：**
```bash
ssh root@47.237.69.93
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health
```
若返回 `200` 说明应用正常，多半是 Nginx 配置或 upstream 端口不对；若连不上，继续下面。

**② 看进程：**
```bash
ps aux | grep node
# 或若用 pm2： pm2 list
```

**③ 在项目目录重启应用：**
```bash
cd /opt/test
npm run start:production
# 或： nohup node dist/main.js &
# 或： pm2 restart team-app
```

**④ 看 Nginx 反向代理配置**（upstream 是否指向 127.0.0.1:3000）：
```bash
grep -r "proxy_pass\|upstream" /etc/nginx/
```

**⑤ 看应用日志**（若有）：  
`/opt/test` 下是否有日志文件，或 `pm2 logs`。

## 10. 504 Gateway Time-out 排查

504 表示 Nginx 等上游（Node）响应超时。按顺序做：

**① 确认 Node 在跑且能响应：**
```bash
ssh root@47.237.69.93
curl -s http://127.0.0.1:3000/health
```
- 有 JSON 返回 → 应用正常，多半是 Nginx 超时时间太短或 upstream 配置不对。
- 无响应 → 应用没起来，先启动：`cd /opt/test && npm run build && nohup node dist/main.js > /tmp/team-app.log 2>&1 &`

**② 调大 Nginx 超时并确认 upstream：**  
在 Nginx 的 `server` 或 `location` 里加上（或改大）：
```nginx
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
proxy_pass http://127.0.0.1:3000;
```
然后：`sudo nginx -t && sudo systemctl reload nginx`。

**③ 若仍 504**：看应用日志 `tail -100 /tmp/team-app.log`，确认是否有报错或卡死。
