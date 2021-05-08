/* eslint-disable @typescript-eslint/no-var-requires */
import * as util_functions from '../util_functions';
import Discord from 'discord.js';
import { nanoid } from 'nanoid';
import * as Types from '../types';
const ticketcreate = {
  name: 'ticket',
  syntax: 'ticket create <moderator_role: role_id> <user: user_id>',
  explanation:
    'Create a ticket. Moderator role is the role allowed to view the channel and user is the user who will be added to the ticket',
  permissions: (msg: util_functions.EMessage) =>
    msg.member?.hasPermission('MANAGE_CHANNELS'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: { moderator_role: string; user: string },
    client: Discord.Client
  ) => {
    if (!msg.guild) return;
    if (!client.user) return;
    if (!msg.member) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
    if (!msg.member.roles.cache.get(cmd.moderator_role))
      throw new util_functions.BotError('user', "You don't have that role!");
    try {
      const channel = await msg.guild.channels.create('ticket-' + nanoid(15), {
        type: 'text',
        permissionOverwrites: [
          {
            id: msg.guild.id,
            deny: ['VIEW_CHANNEL'],
          },
          {
            id: cmd.moderator_role,
            allow: ['VIEW_CHANNEL'],
          },
          {
            id: cmd.user,
            allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
          },
        ],
      });
      msg.dbReply(`Created ${channel}`);
      await channel.send(`<@${cmd.user}>, a ticket has been created for you`);
      setTimeout(() => {
        channel.overwritePermissions([
          {
            id: channel.guild.id,
            deny: ['VIEW_CHANNEL'],
          },
          {
            id: cmd.moderator_role,
            allow: ['VIEW_CHANNEL'],
          },
          {
            id: cmd.user,
            allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
          },
        ]);
      }, 1000);
      await Types.LogChannel.tryToLog(
        msg,
        `Created ticket ${channel} for <@${cmd.user}>`
      );
    } catch (e) {
      throw new util_functions.BotError(
        'user',
        `Failed to create channel: ${e}`
      );
    }
  },
};
const ticketdelete = {
  name: 'ticket',
  syntax: 'ticket delete',
  explanation: 'Delete the current ticket channel',
  permissions: (msg: util_functions.EMessage) =>
    msg.member?.hasPermission('MANAGE_CHANNELS'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: Record<string, never>,
    client: Discord.Client
  ) => {
    if (!msg.guild) return;
    if (!client.user) return;
    if (!msg.member) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
    if (msg.channel.type == 'text' && msg.channel.name.startsWith('ticket-')) {
      msg.dbReply('Deleting channel in 10 seconds');
      msg.channel.updateOverwrite(msg.guild.id, { SEND_MESSAGES: false });
      setTimeout(() => {
        msg.channel.delete();
      }, 10000);
      await Types.LogChannel.tryToLog(
        msg,
        `Deleted ticket #${msg.channel.name}`
      );
    } else {
      throw new util_functions.BotError('user', 'Not a ticket');
    }
  },
};
exports.commandModule = {
  title: 'Tickets',
  description: 'Commands for creating tickets',
  commands: [ticketcreate, ticketdelete],
};
