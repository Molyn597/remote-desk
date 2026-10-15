import { createWsRelayServer } from '@trystero-p2p/ws-relay/server';

const port = Number(process.env.PORT ?? 8080);
const server = createWsRelayServer({
  port,
  maxPayload: 64 * 1024,
  onError: (err) => console.error('relay error:', err.message),
});

await server.ready;
console.log(`Remote Desk relay listening on :${port}`);

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
