import { fileURLToPath } from 'node:url';
import { buildGatewayApp } from './app.js';

async function start() {
  const app = await buildGatewayApp();
  const port = Number(process.env.GATEWAY_PORT ?? 3011);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Gateway agent service running on http://localhost:${port}`);
}

const entryPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;

if (entryPath) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
