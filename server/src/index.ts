import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createJsonRepository } from './database/json-repository';
import { createApplication } from './app';

const port = Number(process.env.PORT ?? 3001);
const databasePath = process.env.DATABASE_PATH
  ? resolve(process.env.DATABASE_PATH)
  : fileURLToPath(new URL('../data/database.json', import.meta.url));
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

async function main(): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_ORIGIN) {
    throw new Error('Set CLIENT_ORIGIN to the public application origin in production.');
  }
  const repository = await createJsonRepository(databasePath);
  const application = await createApplication(repository, {
    allowedOrigins, secureCookies: process.env.NODE_ENV === 'production',
  });
  application.httpServer.listen(port, () => {
    console.warn(`[server] Bridge Online listening on port ${port}`);
  });
  let stopping = false;
  const shutdown = (): void => {
    if (stopping) return;
    stopping = true;
    void application.close().then(() => process.exit(0)).catch((error: unknown) => {
      console.error('[server] Shutdown failed:', error);
      process.exit(1);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void main().catch((error: unknown) => {
  console.error('[server] Startup failed:', error);
  process.exitCode = 1;
});