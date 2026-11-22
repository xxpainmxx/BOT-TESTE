import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, '../.env');
const cwdEnvPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(cwdEnvPath)) {
  dotenv.config({ path: cwdEnvPath });
}

const cleanToken = (raw) =>
  (raw || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^Bot\s+/i, '');

const cleanValue = (raw) => (raw || '').trim().replace(/^['"]|['"]$/g, '');

const parsePositiveInt = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const resolvedToken = cleanToken(
  process.env.DISCORD_TOKEN || process.env.TOKEN || process.env.BOT_TOKEN,
);

export const config = Object.freeze({
  token: resolvedToken,
  clientId: cleanValue(process.env.CLIENT_ID),
  guildId: cleanValue(process.env.GUILD_ID),
  channels: {
    honeypot: cleanValue(process.env.CANAL_ISCA),
    logs: cleanValue(process.env.CANAL_LOGS),
    welcome: cleanValue(process.env.CANAL_BOAS_VINDAS),
    leave: cleanValue(process.env.CANAL_SAIDA),
    levelUp: cleanValue(process.env.CANAL_LEVEL_UP),
  },
  register: {
    emoji: cleanValue(process.env.EMOJI_REGISTRO) || '✅',
    roleId: cleanValue(process.env.CARGO_REGISTRADO),
    messageId: cleanValue(process.env.MSG_REGISTRO_ID),
  },
  xp: {
    perMinute: parsePositiveInt(process.env.XP_POR_MINUTO, 15),
    tickSeconds: parsePositiveInt(process.env.XP_INTERVALO_SEGUNDOS, 60),
  },
});

export function validateConfig() {
  if (!config.token || config.token === 'COLOQUE_SEU_TOKEN_AQUI') {
    return {
      ok: false,
      reason:
        'DISCORD_TOKEN não configurado. Defina DISCORD_TOKEN no arquivo .env (ou nas variáveis de ambiente da Discloud) e reinicie o bot.',
    };
  }
  return { ok: true };
}

