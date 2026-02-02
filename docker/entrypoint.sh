#!/bin/sh
set -e

# Run DB migrations in production-safe mode.
# If you prefer manual migrations, comment this out.
echo "[entrypoint] Running prisma migrate deploy..."
# prisma CLI must be available in the runtime image
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] Starting app..."
exec node dist/src/main.js
