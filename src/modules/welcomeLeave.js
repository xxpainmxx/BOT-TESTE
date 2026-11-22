import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

export async function handleMemberAdd(member) {
  if (!config.channels.welcome) return;

  try {
    const channel = await member.guild.channels.fetch(config.channels.welcome).catch(() => null);
    if (!channel?.isTextBased()) return;

    const createdUnix = Math.floor(member.user.createdTimestamp / 1000);
    const embed = new EmbedBuilder()
      .setColor(0x16a34a)
      .setTitle('Novo Membro na Comunidade')
      .setDescription(`Boas-vindas, ${member}! Sinta-se em casa no servidor **${member.guild.name}**.`)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${member.user.tag}\n\`${member.id}\``, inline: true },
        { name: 'Conta Criada', value: `<t:${createdUnix}:R>`, inline: true },
        { name: 'Membros no Servidor', value: `${member.guild.memberCount}`, inline: true },
      )
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[Welcome] Erro ao enviar embed de entrada:', err.message);
  }
}

export async function handleMemberRemove(member) {
  const targetChannelId = config.channels.leave || config.channels.welcome;
  if (!targetChannelId) return;

  try {
    const channel = await member.guild.channels.fetch(targetChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;

    const userTag = member.user?.tag || 'Usuário Desconhecido';
    const avatarUrl = member.user?.displayAvatarURL({ size: 256 }) || null;

    const embed = new EmbedBuilder()
      .setColor(0x64748b)
      .setTitle('Saída do Servidor')
      .setDescription(`**${userTag}** deixou a comunidade.`)
      .addFields(
        { name: 'Identificação', value: `${userTag}\n\`${member.id}\``, inline: true },
        { name: 'Membros Restantes', value: `${member.guild.memberCount}`, inline: true },
      )
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    if (avatarUrl) {
      embed.setThumbnail(avatarUrl);
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[Leave] Erro ao enviar embed de saída:', err.message);
  }
}
