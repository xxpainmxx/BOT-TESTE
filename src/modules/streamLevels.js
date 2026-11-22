import { ActivityType, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import {
  addGameXp,
  getUserProfile,
  normalizeGameKey,
  xpRequiredForLevel,
} from '../storage/levelStore.js';

/**
 * Mapa em memória apenas para sessões ativas de transmissão em call.
 * Mantém o consumo de RAM mínimo mesmo em servidores grandes.
 */
const activeStreams = new Map();
let tickInterval = null;

function awardElapsedXp(client, session, now = Date.now()) {
  const elapsedMs = now - session.lastTick;
  if (elapsedMs < 5_000) return null;

  const elapsedMinutes = elapsedMs / 60_000;
  const xpGain = Math.floor(elapsedMinutes * config.xp.perMinute);
  if (xpGain <= 0) return null;

  session.lastTick = now;
  const result = addGameXp(
    session.guildId,
    session.userId,
    session.gameName,
    xpGain,
    elapsedMinutes,
  );

  if (result?.gameLeveledUp && config.channels.levelUp) {
    void notifyLevelUp(client, session.guildId, session.userId, result);
  }

  return result;
}

async function notifyLevelUp(client, guildId, userId, result) {
  try {
    const channel = await client.channels.fetch(config.channels.levelUp).catch(() => null);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Novo Nível em Transmissão')
      .setDescription(
        `<@${userId}> alcançou o **Nível ${result.gameLevel}** em **${result.gameName}** transmitindo em call.`,
      )
      .addFields(
        { name: 'XP do Jogo', value: `${result.gameXp} XP`, inline: true },
        { name: 'Nível Global', value: `Nv. ${result.totalLevel}`, inline: true },
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch {
    // Falha silenciosa para não interromper o loop de XP
  }
}

function getPlayingGameName(guild, userId, member, presenceOverride) {
  const presence = presenceOverride || member?.presence || guild.presences.cache.get(userId);
  if (!presence?.activities?.length) return null;

  const playing = presence.activities.find(
    (activity) => activity.type === ActivityType.Playing && Boolean(activity.name),
  );
  return playing ? playing.name.trim() : null;
}

export function reconcileStreamSession(client, guild, userId, voiceState, presenceOverride = null) {
  if (!guild || !userId) return;

  const member = voiceState?.member || guild.members.cache.get(userId) || null;
  const user = member?.user || client.users.cache.get(userId) || presenceOverride?.user || null;
  if (user?.bot) return;

  const key = `${guild.id}:${userId}`;
  const inVoice = Boolean(voiceState?.channelId);
  const notAfk = !guild.afkChannelId || voiceState.channelId !== guild.afkChannelId;
  const isStreaming = Boolean(voiceState?.streaming);
  const activeGame =
    inVoice && notAfk && isStreaming ? getPlayingGameName(guild, userId, member, presenceOverride) : null;

  const current = activeStreams.get(key);

  if (current) {
    if (!activeGame || normalizeGameKey(current.gameName) !== normalizeGameKey(activeGame)) {
      awardElapsedXp(client, current);
      activeStreams.delete(key);
    } else {
      return;
    }
  }

  if (activeGame) {
    activeStreams.set(key, {
      guildId: guild.id,
      userId,
      gameName: activeGame,
      lastTick: Date.now(),
    });
  }
}

export function flushAllActiveStreams(client) {
  const now = Date.now();
  for (const session of activeStreams.values()) {
    awardElapsedXp(client, session, now);
  }
}

export function startStreamLevelTicker(client) {
  // Verifica sessões já ativas ao iniciar o bot
  for (const guild of client.guilds.cache.values()) {
    for (const voiceState of guild.voiceStates.cache.values()) {
      if (voiceState.streaming && voiceState.member) {
        reconcileStreamSession(client, guild, voiceState.member, voiceState);
      }
    }
  }

  if (tickInterval) clearInterval(tickInterval);

  tickInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, session] of activeStreams.entries()) {
      const guild = client.guilds.cache.get(session.guildId);
      const voiceState = guild?.voiceStates.cache.get(session.userId);
      const member = voiceState?.member || guild?.members.cache.get(session.userId);

      const stillEligible =
        Boolean(guild) &&
        Boolean(voiceState?.channelId) &&
        Boolean(voiceState?.streaming) &&
        (!guild.afkChannelId || voiceState.channelId !== guild.afkChannelId);

      const currentGame = stillEligible && member ? getPlayingGameName(guild, member) : null;

      if (!currentGame || normalizeGameKey(currentGame) !== normalizeGameKey(session.gameName)) {
        awardElapsedXp(client, session, now);
        activeStreams.delete(key);
        if (currentGame && member) {
          activeStreams.set(key, {
            guildId: guild.id,
            userId: member.id,
            gameName: currentGame,
            lastTick: now,
          });
        }
        continue;
      }

      awardElapsedXp(client, session, now);
    }
  }, config.xp.tickSeconds * 1000);

  if (typeof tickInterval.unref === 'function') {
    tickInterval.unref();
  }
}

export function stopStreamLevelTicker(client) {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  flushAllActiveStreams(client);
  activeStreams.clear();
}

export async function handleLevelCommand(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'Este comando só funciona em servidores.', ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('usuario') || interaction.user;
  const gameFilter = interaction.options.getString('jogo')?.trim() || '';
  const profile = getUserProfile(interaction.guildId, targetUser.id);

  if (!profile || Object.keys(profile.games).length === 0) {
    await interaction.reply({
      content: `${targetUser.username} ainda não acumulou XP transmitindo jogos em call.`,
      ephemeral: true,
    });
    return;
  }

  const gamesList = Object.values(profile.games).sort((a, b) => b.xp - a.xp);
  const filteredGames = gameFilter
    ? gamesList.filter((g) => g.name.toLowerCase().includes(gameFilter.toLowerCase()))
    : gamesList.slice(0, 8);

  if (gameFilter && filteredGames.length === 0) {
    await interaction.reply({
      content: `Nenhum registro encontrado para o jogo **${gameFilter}** em ${targetUser.username}.`,
      ephemeral: true,
    });
    return;
  }

  const nextTotalXp = xpRequiredForLevel(profile.totalLevel + 1);
  const gamesText = filteredGames
    .map((g, index) => {
      const nextGameXp = xpRequiredForLevel(g.level + 1);
      const mins = Math.round(g.minutes);
      return `**${index + 1}. ${g.name}** — Nv. **${g.level}** (${g.xp}/${nextGameXp} XP · ${mins} min)`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({
      name: `Níveis de Stream · ${targetUser.username}`,
      iconURL: targetUser.displayAvatarURL({ size: 128 }),
    })
    .addFields(
      { name: 'Nível Global', value: `Nv. ${profile.totalLevel}`, inline: true },
      { name: 'XP Total', value: `${profile.totalXp} / ${nextTotalXp} XP`, inline: true },
      { name: 'Tempo Transmitindo', value: `${Math.round(profile.totalMinutes)} min`, inline: true },
      {
        name: gameFilter ? `Filtro: ${gameFilter}` : 'Top Jogos Transmitidos em Call',
        value: gamesText.slice(0, 1024),
      },
    )
    .setFooter({ text: 'Ganhe XP transmitindo seu jogo ativo em um canal de voz.' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
