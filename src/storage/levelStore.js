import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.resolve(process.cwd(), 'levels.json');
const TEMP_FILE = `${DATA_FILE}.tmp`;
const SAVE_THROTTLE_MS = 30_000;

let store = {
  meta: {
    registerMessageId: '',
  },
  users: {},
};

let isDirty = false;
let saveTimer = null;
let writingPromise = null;

/**
 * Curva progressiva leve: Level 1 = 100 XP, Level 2 = 282 XP, Level 3 = 519 XP...
 */
export function xpRequiredForLevel(level) {
  if (level <= 0) return 0;
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function calculateLevelFromXp(xp) {
  let level = 0;
  while (xp >= xpRequiredForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

export function normalizeGameKey(gameName) {
  return gameName.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 64);
}

export function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        store = {
          meta: {
            registerMessageId: parsed?.meta?.registerMessageId || '',
          },
          users: parsed?.users && typeof parsed.users === 'object' ? parsed.users : {},
        };
      }
    }
  } catch (err) {
    console.error('[levelStore] Erro ao carregar levels.json, iniciando vazio:', err.message);
  }
}

function scheduleSave() {
  isDirty = true;
  if (saveTimer) return;

  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flushStore();
  }, SAVE_THROTTLE_MS);

  if (typeof saveTimer.unref === 'function') {
    saveTimer.unref();
  }
}

export async function flushStore() {
  if (!isDirty) return;
  if (writingPromise) {
    await writingPromise;
    return;
  }

  isDirty = false;
  const payload = JSON.stringify(store);

  writingPromise = (async () => {
    try {
      await fsp.writeFile(TEMP_FILE, payload, 'utf8');
      await fsp.rename(TEMP_FILE, DATA_FILE);
    } catch (err) {
      isDirty = true;
      console.error('[levelStore] Falha ao gravar levels.json:', err.message);
    } finally {
      writingPromise = null;
    }
  })();

  await writingPromise;
}

export function getRegisterMessageId(envFallback = '') {
  return envFallback || store.meta.registerMessageId || '';
}

export function setRegisterMessageId(messageId) {
  store.meta.registerMessageId = messageId;
  scheduleSave();
}

export function getUserProfile(guildId, userId) {
  const key = `${guildId}:${userId}`;
  return store.users[key] || null;
}

export function addGameXp(guildId, userId, gameName, xpGain, minutesGain) {
  if (xpGain <= 0 || !gameName) return null;

  const userKey = `${guildId}:${userId}`;
  const gameKey = normalizeGameKey(gameName);

  if (!store.users[userKey]) {
    store.users[userKey] = {
      totalXp: 0,
      totalLevel: 0,
      totalMinutes: 0,
      games: {},
    };
  }

  const profile = store.users[userKey];
  if (!profile.games[gameKey]) {
    profile.games[gameKey] = {
      name: gameName.slice(0, 64),
      xp: 0,
      level: 0,
      minutes: 0,
    };
  }

  const gameData = profile.games[gameKey];
  const prevGameLevel = gameData.level;
  const prevTotalLevel = profile.totalLevel;

  gameData.name = gameName.slice(0, 64);
  gameData.xp += xpGain;
  gameData.minutes += minutesGain;
  gameData.level = calculateLevelFromXp(gameData.xp);

  profile.totalXp += xpGain;
  profile.totalMinutes += minutesGain;
  profile.totalLevel = calculateLevelFromXp(profile.totalXp);

  scheduleSave();

  return {
    gameName: gameData.name,
    gameXp: gameData.xp,
    gameLevel: gameData.level,
    gameLeveledUp: gameData.level > prevGameLevel,
    totalXp: profile.totalXp,
    totalLevel: profile.totalLevel,
    totalLeveledUp: profile.totalLevel > prevTotalLevel,
  };
}
