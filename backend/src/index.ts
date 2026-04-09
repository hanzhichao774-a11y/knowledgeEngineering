import { fileURLToPath } from 'node:url';
import { buildApp, loadBackendEnv } from './app.js';

const isMock = process.argv.includes('--mock');

async function start() {
  loadBackendEnv();
  const app = await buildApp();
  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`BizAgentOS Backend running on http://localhost:${port}`);
  if (isMock) console.log('Mock mode enabled');
}

const isEntryPoint = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;

if (isEntryPoint) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { isMock, buildApp };
