import http from 'node:http';
import { validateConfig } from './src/config.js';

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const configCheck = validateConfig();

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(
    configCheck.ok
      ? 'Gaming Community Bot: rodando (npm start / index.js).'
      : `Gaming Community Bot: ${configCheck.reason}`,
  );
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[Dev] Porta ${PORT} ativa para o ambiente.`);

  if (configCheck.ok) {
    await import('./index.js');
  } else {
    console.log(`[Dev] ${configCheck.reason}`);
  }
});
