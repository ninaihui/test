import { ThrottlerModuleOptions } from '@nestjs/throttler';

// Simple, safe defaults. Override via env if needed.
export function getThrottleConfig(): ThrottlerModuleOptions {
  const ttlMs = Number(process.env.THROTTLE_TTL_MS || 60_000);
  const limit = Number(process.env.THROTTLE_LIMIT || 30);

  return {
    throttlers: [{ ttl: ttlMs, limit }],
  };
}
