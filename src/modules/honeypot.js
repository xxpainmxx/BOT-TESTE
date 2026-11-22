import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';

async function sendHoneypotLog(guild, embed) {
  if (!config.channels.logs) return;
  try {
    const logChannel = await guild.channels.fetch(config.channels.logs).catch(() => null);
    if (logChannel?.isTextBased()) {
      await logChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('[Honeypot] Erro ao enviar log:', err.message);
  }
}

export async function handleHoneypotMessage(message) {
  if (!config.channels.honeypot) return;
  if (!message.inGuild() || message.author.bot) return;
  if (message.channelId !== config.channels.honeypot) return;

  const member =
    message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));

  // Protege administradores e moderadores com permissão de banimento
  if (
    member?.permissions.has(PermissionFlagsBits.Administrator) ||
    member?.permissions.has(PermissionFlagsBits.BanMembers)
  ) {
    return;
  }

  const contentPreview = message.content?.trim()
    ? message.content.trim().slice(0, 500)
    : '(sem texto / apenas anexo ou embed)';
  const attachmentCount = message.attachments?.size || 0;

  // Remove a mensagem imediatamente
  await message.delete().catch(() => {});

  const botMember = message.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers)) {
    const warnEmbed = new EmbedBuilder()
      .setColor(0xd97706)
      .setTitle('Honeypot: Falta Permissão de Banimento')
      .setDescription(
        `Mensagem removida de **${message.author.tag}** (\`${message.author.id}\`) em <#${message.channelId}>, mas o bot não possui permissão **Banir Membros**.`,
      )
      .setTimestamp();
    await sendHoneypotLog(message.guild, warnEmbed);
    return;
  }

  if (member && !member.bannable) {
    const warnEmbed = new EmbedBuilder()
      .setColor(0xd97706)
      .setTitle('Honeypot: Hierarquia Impediu Banimento')
      .setDescription(
        `Mensagem removida de **${message.author.tag}** (\`${message.author.id}\`) em <#${message.channelId}>, mas o cargo do usuário é igual ou superior ao do bot.`,
      )
      .setTimestamp();
    await sendHoneypotLog(message.guild, warnEmbed);
    return;
  }

  try {
    await message.guild.members.ban(message.author.id, {
      deleteMessageSeconds: 86_400,
      reason: 'Anti-spam Honeypot: enviou mensagem no canal isca.',
    });

    const logEmbed = new EmbedBuilder()
      .setColor(0xdc2626)
      .setTitle('Banimento Automático · Canal Isca')
      .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: 'Usuário', value: `${message.author.tag}\n\`${message.author.id}\``, inline: true },
        { name: 'Canal Isca', value: `<#${message.channelId}>`, inline: true },
        { name: 'Anexos', value: `${attachmentCount}`, inline: true },
        { name: 'Conteúdo Capturado', value: `\`\`\`\n${contentPreview.replace(/```/g, "'''")}\n\`\`\`` },
      )
      .setTimestamp();

    await sendHoneypotLog(message.guild, logEmbed);
  } catch (err) {
    console.error(`[Honeypot] Falha ao banir ${message.author.id}:`, err.message);
  }
}
