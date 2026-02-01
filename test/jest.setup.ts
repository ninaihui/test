// Minimal env for e2e bootstrapping.
// Keep this only for tests: do NOT rely on this in production.
process.env.JWT_SECRET ||= 'test-secret';

// Default local DB for dev/e2e. If you run Postgres via docker-compose.yml,
// this should work out of the box.
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@localhost:5432/team_management?schema=public';

// E2E hits a real database. To avoid surprise failures in CI/dev machines,
// we require an explicit opt-in.
if (process.env.E2E !== '1') {
  process.env.SKIP_E2E = '1';
}
