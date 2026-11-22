import { PermissionFlagsBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';

export const commandsData = [
  new SlashCommandBuilder()
    .setName('level')
    .setDescription('Consulta seu XP e nível por jogo compartilhado em call.')
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Membro para consultar (padrão: você mesmo).')
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('jogo')
        .setDescription('Filtrar por um jogo específico.')
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('anunciar')
    .setDescription('Abre um painel para publicar um anúncio em nome do bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('painel-cargos')
    .setDescription('Envia o painel interativo de cargos com botões configuráveis.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('painel-registro')
    .setDescription('Publica a mensagem de registro por reação em emoji.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((cmd) => cmd.toJSON());

export async function syncSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);

  if (config.guildId && config.guildId !== 'COLOQUE_O_ID_DO_SERVIDOR_AQUI') {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commandsData,
    });
    console.log(`[Commands] ${commandsData.length} comandos sincronizados no servidor ${config.guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), {
      body: commandsData,
    });
    console.log(`[Commands] ${commandsData.length} comandos sincronizados globalmente.`);
  }
}
