import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import { getRegisterMessageId, setRegisterMessageId } from '../storage/levelStore.js';

function matchesConfiguredEmoji(reactionEmoji, configuredEmoji) {
  if (!configuredEmoji) return false;
  const trimmed = configuredEmoji.trim();

  // Suporta formato custom <:nome:id> ou <a:nome:id>
  const customMatch = trimmed.match(/^<a?:[\w~]+:(\d+)>$/);
  if (customMatch) {
    return reactionEmoji.id === customMatch[1];
  }

  // Suporta ID direto de emoji customizado ou caractere Unicode
  return reactionEmoji.id === trimmed || reactionEmoji.name === trimmed;
}

export async function handleRegisterPanelCommand(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Apenas administradores podem publicar o painel de registro.',
      ephemeral: true,
    });
    return;
  }

  if (!config.register.roleId) {
    await interaction.reply({
      content: 'Defina `CARGO_REGISTRADO` no arquivo `.env` antes de criar o painel.',
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x16a34a)
    .setTitle('Registro & Regras da Comunidade')
    .setDescription(
      [
        'Para liberar o acesso completo aos canais e calls de jogos, leia as regras básicas abaixo:',
        '',
        '1. Respeite todos os membros na call e no chat.',
        '2. Proibido spam, divulgação não autorizada ou flood.',
        '3. Utilize os canais corretos para cada jogo ou assunto.',
        '',
        `Reaja abaixo com ${config.register.emoji} para confirmar seu registro e receber o cargo de membro.`,
      ].join('\n'),
    )
    .setFooter({ text: interaction.guild.name })
    .setTimestamp();

  const sentMessage = await interaction.channel.send({ embeds: [embed] });

  try {
    await sentMessage.react(config.register.emoji);
  } catch (err) {
    await interaction.reply({
      content: `Mensagem enviada, mas não consegui reagir com \`${config.register.emoji}\`: ${err.message}`,
      ephemeral: true,
    });
    return;
  }

  setRegisterMessageId(sentMessage.id);

  await interaction.reply({
    content: `Painel de registro publicado! ID da mensagem salvo automaticamente (\`${sentMessage.id}\`).`,
    ephemeral: true,
  });
}

export async function handleReactionRegisterAdd(reaction, user) {
  if (user.bot) return;

  try {
    if (reaction.partial) {
      await reaction.fetch();
    }
    if (user.partial) {
      await user.fetch();
    }
  } catch {
    return;
  }

  const guild = reaction.message.guild;
  if (!guild || !config.register.roleId) return;

  const targetMessageId = getRegisterMessageId(config.register.messageId);
  if (!targetMessageId || reaction.message.id !== targetMessageId) return;

  if (!matchesConfiguredEmoji(reaction.emoji, config.register.emoji)) return;

  try {
    const member = await guild.members.fetch(user.id);
    if (!member || member.roles.cache.has(config.register.roleId)) return;

    const botMember = guild.members.me;
    const role = await guild.roles.fetch(config.register.roleId).catch(() => null);
    if (!role) return;

    if (
      !botMember?.permissions.has(PermissionFlagsBits.ManageRoles) ||
      botMember.roles.highest.position <= role.position
    ) {
      console.warn('[Register] Bot sem permissão ou hierarquia para entregar CARGO_REGISTRADO.');
      return;
    }

    await member.roles.add(role, 'Registro automático por reação em emoji');
  } catch (err) {
    console.error('[Register] Erro ao atribuir cargo por reação:', err.message);
  }
}
