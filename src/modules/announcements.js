import {
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

export const ANNOUNCE_MODAL_ID = 'modal_anuncio_bot';

function extractChannelId(rawInput, fallbackChannelId) {
  const cleaned = rawInput.trim();
  if (!cleaned) return fallbackChannelId;
  const match = cleaned.match(/^<#(\d{17,20})>$|^(\d{17,20})$/);
  return match ? match[1] || match[2] : null;
}

function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function handleAnnounceCommand(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Apenas administradores podem usar o painel de anúncios.',
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(ANNOUNCE_MODAL_ID)
    .setTitle('Publicar Anúncio do Servidor');

  const titleInput = new TextInputBuilder()
    .setCustomId('titulo')
    .setLabel('Título do Anúncio')
    .setPlaceholder('Ex.: Torneio de Sexta-feira · Inscrições Abertas')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(256)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('descricao')
    .setLabel('Mensagem / Descrição')
    .setPlaceholder('Escreva os detalhes do anúncio (suporta formatação Markdown do Discord).')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(4000)
    .setRequired(true);

  const imageInput = new TextInputBuilder()
    .setCustomId('imagem_url')
    .setLabel('URL da Imagem (opcional)')
    .setPlaceholder('https://exemplo.com/banner.png')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(500)
    .setRequired(false);

  const channelInput = new TextInputBuilder()
    .setCustomId('canal_id')
    .setLabel('ID ou Menção do Canal (vazio = canal atual)')
    .setPlaceholder('Ex.: 123456789012345678 ou #anuncios')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(64)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descriptionInput),
    new ActionRowBuilder().addComponents(imageInput),
    new ActionRowBuilder().addComponents(channelInput),
  );

  await interaction.showModal(modal);
}

export async function handleAnnounceModalSubmit(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Permissão insuficiente para enviar anúncios.',
      ephemeral: true,
    });
    return;
  }

  const titulo = interaction.fields.getTextInputValue('titulo').trim();
  const descricao = interaction.fields.getTextInputValue('descricao').trim();
  const imagemUrl = interaction.fields.getTextInputValue('imagem_url').trim();
  const canalInput = interaction.fields.getTextInputValue('canal_id').trim();

  if (imagemUrl && !isValidHttpUrl(imagemUrl)) {
    await interaction.reply({
      content: 'A URL da imagem precisa começar com `http://` ou `https://`.',
      ephemeral: true,
    });
    return;
  }

  const targetChannelId = extractChannelId(canalInput, interaction.channelId);
  if (!targetChannelId) {
    await interaction.reply({
      content: 'Canal inválido. Informe um ID numérico válido, uma menção `<#ID>` ou deixe em branco.',
      ephemeral: true,
    });
    return;
  }

  const targetChannel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
  if (!targetChannel || !targetChannel.isTextBased()) {
    await interaction.reply({
      content: 'Não encontrei um canal de texto válido com esse ID.',
      ephemeral: true,
    });
    return;
  }

  const botMember = interaction.guild.members.me;
  const botPerms = targetChannel.permissionsFor(botMember);
  if (
    !botPerms?.has(PermissionFlagsBits.SendMessages) ||
    !botPerms?.has(PermissionFlagsBits.EmbedLinks)
  ) {
    await interaction.reply({
      content: `Não tenho permissão de **Enviar Mensagens** e **Inserir Links** em ${targetChannel}.`,
      ephemeral: true,
    });
    return;
  }

  const guildIcon = interaction.guild.iconURL({ size: 128 });
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(titulo)
    .setDescription(descricao)
    .setTimestamp();

  if (guildIcon) {
    embed.setFooter({ text: interaction.guild.name, iconURL: guildIcon });
  } else {
    embed.setFooter({ text: interaction.guild.name });
  }

  if (imagemUrl) {
    embed.setImage(imagemUrl);
  }

  const sentMessage = await targetChannel.send({ embeds: [embed] });
  await interaction.reply({
    content: `Anúncio publicado em ${targetChannel} ([ver mensagem](${sentMessage.url})).`,
    ephemeral: true,
  });
}
