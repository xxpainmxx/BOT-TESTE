import http from 'node:http';
import { config } from './src/config.js';

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const hasToken =
  Boolean(config.token) &&
  config.token !== 'COLOQUE_SEU_TOKEN_AQUI' &&
  Boolean(config.clientId) &&
  config.clientId !== 'COLOQUE_O_ID_DO_BOT_AQUI';

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(
    hasToken
      ? 'Gaming Community Bot: rodando (npm start / index.js).'
      : 'Gaming Community Bot: aguardando DISCORD_TOKEN e CLIENT_ID no arquivo .env.',
  );
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[Dev] Porta ${PORT} ativa para o ambiente.`);

  if (hasToken) {
    await import('./index.js');
  } else {
    console.log('[Dev] Defina DISCORD_TOKEN e CLIENT_ID no .env para conectar o bot ao Discord.');
  }
});
