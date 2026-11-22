import {
  Client,
  Events,
  GatewayIntentBits,
  Options,
  Partials,
} from 'discord.js';
import { config, validateConfig } from './src/config.js';
import { syncSlashCommands } from './src/commands/registerCommands.js';
import { flushStore, loadStore } from './src/storage/levelStore.js';
import {
  handleLevelCommand,
  reconcileStreamSession,
  startStreamLevelTicker,
  stopStreamLevelTicker,
} from './src/modules/streamLevels.js';
import {
  ANNOUNCE_MODAL_ID,
  handleAnnounceCommand,
  handleAnnounceModalSubmit,
} from './src/modules/announcements.js';
import {
  handleRoleButtonInteraction,
  handleRolePanelCommand,
  ROLE_BUTTON_PREFIX,
} from './src/modules/rolePanel.js';
import { handleHoneypotMessage } from './src/modules/honeypot.js';
import { handleMemberAdd, handleMemberRemove } from './src/modules/welcomeLeave.js';
import {
  handleReactionRegisterAdd,
  handleRegisterPanelCommand,
} from './src/modules/reactionRegister.js';

validateConfig();
loadStore();

/**
 * Cliente configurado com limites rígidos de cache e sweepers
 * para operar com folga abaixo de 200 MB de RAM (alvo: 50–110 MB).
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User,
  ],
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 20,
    GuildMemberManager: {
      maxSize: 50,
      keepOverLimit: (member) => member.id === member.client.user?.id,
    },
    UserManager: {
      maxSize: 50,
      keepOverLimit: (user) => user.id === user.client.user?.id,
    },
    ReactionManager: 0,
    ReactionUserManager: 0,
    VoiceStateManager: {
      maxSize: 100,
      keepOverLimit: (voiceState) => Boolean(voiceState.channelId),
    },
    PresenceManager: {
      maxSize: 150,
      keepOverLimit: (presence) =>
        Boolean(presence.guild?.voiceStates.cache.get(presence.userId)?.channelId),
    },
    ThreadManager: 0,
    ThreadMemberManager: 0,
    GuildEmojiManager: 0,
    GuildStickerManager: 0,
    GuildScheduledEventManager: 0,
    StageInstanceManager: 0,
    GuildInviteManager: 0,
    GuildBanManager: 0,
    AutoModerationRuleManager: 0,
  }),
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: {
      interval: 300,
      lifetime: 600,
    },
    users: {
      interval: 600,
      filter: () => (user) => user.id !== client.user?.id,
    },
  },
});

client.once(Events.ClientReady, async (readyClient) => {
  const rssMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  console.log(`[Bot] Online como ${readyClient.user.tag} | RAM atual: ${rssMb} MB`);

  try {
    await syncSlashCommands();
  } catch (err) {
    console.error('[Commands] Falha ao sincronizar slash commands:', err.message);
  }

  startStreamLevelTicker(readyClient);
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const guild = newState.guild || oldState.guild;
  const userId = newState.id || oldState.id;
  reconcileStreamSession(client, guild, userId, newState);
});

client.on(Events.PresenceUpdate, (_oldPresence, newPresence) => {
  if (!newPresence?.guild || !newPresence.userId) return;
  const voiceState = newPresence.guild.voiceStates.cache.get(newPresence.userId);
  if (!voiceState?.streaming) return;
  reconcileStreamSession(client, newPresence.guild, newPresence.userId, voiceState, newPresence);
});

client.on(Events.MessageCreate, async (message) => {
  await handleHoneypotMessage(message);
});

client.on(Events.GuildMemberAdd, async (member) => {
  await handleMemberAdd(member);
});

client.on(Events.GuildMemberRemove, async (member) => {
  await handleMemberRemove(member);
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  await handleReactionRegisterAdd(reaction, user);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'level':
          await handleLevelCommand(interaction);
          break;
        case 'anunciar':
          await handleAnnounceCommand(interaction);
          break;
        case 'painel-cargos':
          await handleRolePanelCommand(interaction);
          break;
        case 'painel-registro':
          await handleRegisterPanelCommand(interaction);
          break;
        default:
          break;
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === ANNOUNCE_MODAL_ID) {
      await handleAnnounceModalSubmit(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith(ROLE_BUTTON_PREFIX)) {
      await handleRoleButtonInteraction(interaction);
    }
  } catch (err) {
    console.error('[Interaction] Erro inesperado:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: 'Ocorreu um erro ao processar esta ação.', ephemeral: true })
        .catch(() => {});
    }
  }
});

let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Bot] Encerrando (${signal}) e salvando levels.json...`);
  stopStreamLevelTicker(client);
  await flushStore();
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

client.login(config.token).catch((err) => {
  console.error('[Bot] Falha no login:', err.message);
  process.exit(1);
});
