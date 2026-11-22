import 'dotenv/config';

const parsePositiveInt = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = Object.freeze({
  token: process.env.DISCORD_TOKEN?.trim() || '',
  clientId: process.env.CLIENT_ID?.trim() || '',
  guildId: process.env.GUILD_ID?.trim() || '',
  channels: {
    honeypot: process.env.CANAL_ISCA?.trim() || '',
    logs: process.env.CANAL_LOGS?.trim() || '',
    welcome: process.env.CANAL_BOAS_VINDAS?.trim() || '',
    leave: process.env.CANAL_SAIDA?.trim() || '',
    levelUp: process.env.CANAL_LEVEL_UP?.trim() || '',
  },
  register: {
    emoji: process.env.EMOJI_REGISTRO?.trim() || '✅',
    roleId: process.env.CARGO_REGISTRADO?.trim() || '',
    messageId: process.env.MSG_REGISTRO_ID?.trim() || '',
  },
  xp: {
    perMinute: parsePositiveInt(process.env.XP_POR_MINUTO, 15),
    tickSeconds: parsePositiveInt(process.env.XP_INTERVALO_SEGUNDOS, 60),
  },
});

export function validateConfig() {
  if (!config.token || config.token === 'COLOQUE_SEU_TOKEN_AQUI') {
    throw new Error('DISCORD_TOKEN não configurado no arquivo .env.');
  }
  if (!config.clientId || config.clientId === 'COLOQUE_O_ID_DO_BOT_AQUI') {
    throw new Error('CLIENT_ID não configurado no arquivo .env.');
  }
}
