# syntax=docker/dockerfile:1

# --- build stage ---
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Native deps for bcrypt (and friends)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install deps
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma Client for the target platform (linux in Docker)
# This must happen before `nest build` because the code imports from ./generated/prisma
RUN npx prisma generate --schema=./prisma/schema.prisma

# Build
RUN npm run build

# --- runtime stage ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Native deps for bcrypt (runtime install step)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev \
  # prisma CLI is required for migrate deploy / generate; install it without touching package-lock
  && npm install prisma --no-save

# App artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/public ./public

# Prisma generate at runtime image build time (needs schema + deps)
RUN npx prisma generate --schema=./prisma/schema.prisma

COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
