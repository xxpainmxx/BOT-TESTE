import fs from 'node:fs';
import path from 'node:path';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';

export const ROLE_BUTTON_PREFIX = 'cargo_toggle:';
const ROLES_FILE = path.resolve(process.cwd(), 'roles.json');

const STYLE_MAP = {
  Primary: ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success: ButtonStyle.Success,
  Danger: ButtonStyle.Danger,
};

function loadRolesConfig() {
  const raw = fs.readFileSync(ROLES_FILE, 'utf8');
  return JSON.parse(raw);
}

export async function handleRolePanelCommand(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Apenas administradores podem enviar o painel de cargos.',
      ephemeral: true,
    });
    return;
  }

  let rolesConfig;
  try {
    rolesConfig = loadRolesConfig();
  } catch (err) {
    await interaction.reply({
      content: `Erro ao ler \`roles.json\`: ${err.message}`,
      ephemeral: true,
    });
    return;
  }

  const cargos = Array.isArray(rolesConfig.cargos) ? rolesConfig.cargos.slice(0, 25) : [];
  if (cargos.length === 0) {
    await interaction.reply({
      content: 'Nenhum cargo configurado em `roles.json`.',
      ephemeral: true,
    });
    return;
  }

  const rows = [];
  for (let i = 0; i < cargos.length; i += 5) {
    const slice = cargos.slice(i, i + 5);
    const row = new ActionRowBuilder();

    for (const item of slice) {
      const btn = new ButtonBuilder()
        .setCustomId(`${ROLE_BUTTON_PREFIX}${item.id}`)
        .setLabel(String(item.label || 'Cargo').slice(0, 80))
        .setStyle(STYLE_MAP[item.style] || ButtonStyle.Secondary);

      if (item.emoji) {
        btn.setEmoji(item.emoji);
      }
      row.addComponents(btn);
    }
    rows.push(row);
  }

  const embed = new EmbedBuilder()
    .setColor(rolesConfig.cor || '#5865F2')
    .setTitle(rolesConfig.titulo || 'Painel de Cargos')
    .setDescription(rolesConfig.descricao || 'Clique nos botões para adicionar ou remover cargos.')
    .setFooter({ text: 'Clique novamente em um botão para remover o cargo.' });

  await interaction.channel.send({ embeds: [embed], components: rows });
  await interaction.reply({
    content: 'Painel de cargos enviado neste canal.',
    ephemeral: true,
  });
}

export async function handleRoleButtonInteraction(interaction) {
  if (!interaction.inGuild()) return;

  const roleId = interaction.customId.slice(ROLE_BUTTON_PREFIX.length);
  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);

  if (!role) {
    await interaction.reply({
      content: 'Este cargo não foi encontrado. Verifique o ID configurado em `roles.json`.',
      ephemeral: true,
    });
    return;
  }

  const botMember = interaction.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: 'Não tenho a permissão **Gerenciar Cargos** neste servidor.',
      ephemeral: true,
    });
    return;
  }

  if (botMember.roles.highest.position <= role.position) {
    await interaction.reply({
      content: `Meu cargo precisa estar acima de **${role.name}** na hierarquia para entregá-lo.`,
      ephemeral: true,
    });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: 'Não foi possível carregar seu perfil.', ephemeral: true });
    return;
  }

  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role, 'Painel de cargos por botão');
    await interaction.reply({
      content: `Cargo **${role.name}** removido.`,
      ephemeral: true,
    });
  } else {
    await member.roles.add(role, 'Painel de cargos por botão');
    await interaction.reply({
      content: `Cargo **${role.name}** adicionado.`,
      ephemeral: true,
    });
  }
}
