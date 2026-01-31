#!/bin/sh
set -e

# Run DB migrations in production-safe mode.
# If you prefer manual migrations, comment this out.
echo "[entrypoint] Running prisma migrate deploy..."
node ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] Starting app..."
exec node dist/main
