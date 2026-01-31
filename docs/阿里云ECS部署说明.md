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
ssh root@你的ECSIP 'cd /opt/team-app && ./stop.sh; ./start-prod.sh'
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
