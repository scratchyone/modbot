/* eslint-disable @typescript-eslint/no-var-requires */
import * as util_functions from '../util_functions';
import Discord from 'discord.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { Command, Context, DisabledCommand } from '../types';
import * as Types from '../types';
const lockdown = {
  name: 'lockdown',
  syntax: 'lockdown [time: string]',
  explanation: 'Prevent everyone for sending messages in this channel',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_CHANNELS'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: { time: string },
    client: Discord.Client
  ) => {
    if (msg.channel.type !== 'text') return;
    if (!msg.guild) return;
    if (!client.user) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
    if (
      await prisma.locked_channels.findFirst({
        where: { channel: msg.channel.id },
      })
    )
      throw new util_functions.BotError(
        'user',
        'Channel is already locked! run `m: unlockdown ' +
          msg.channel +
          '` to unlock'
      );
    if (cmd.time)
      await util_functions.schedule_event(
        {
          type: 'unlockdown',
          channel: msg.channel.id,
        },
        cmd.time
      );
    await prisma.locked_channels.create({
      data: {
        channel: msg.channel.id,
        permissions: JSON.stringify(msg.channel.permissionOverwrites),
      },
    });
    msg.channel.startTyping();
    try {
      for (const perm of msg.channel.permissionOverwrites) {
        await msg.channel.updateOverwrite(perm[0], { SEND_MESSAGES: false });
      }
      await msg.channel.updateOverwrite(msg.guild.id, { SEND_MESSAGES: false });
      await msg.channel.updateOverwrite(client.user.id, {
        SEND_MESSAGES: true,
      });
    } catch (e) {
      await msg.dbReply(
        'Warning: An error has occured. Channel permissions might be messed up!'
      );
      msg.channel.stopTyping();
      throw e;
    }
    await msg.dbReply('Locked!');
    msg.channel.stopTyping();
    if (cmd.time)
      await Types.LogChannel.tryToLog(
        msg,
        `Locked ${msg.channel} for ${cmd.time}`
      );
    else await Types.LogChannel.tryToLog(msg, `Locked ${msg.channel}`);
  },
};
const unlockdown = {
  name: 'unlockdown',
  syntax: 'unlockdown <channel: channel_id>',
  explanation: 'Unlockdown a channel',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_CHANNELS'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: { channel: string },
    client: Discord.Client
  ) => {
    if (!msg.guild) return;
    if (!client.user) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
    const channel = msg.guild.channels.cache.get(cmd.channel);
    if (!channel || channel.type !== 'text') {
      await msg.dbReply("Channel doesn't exist!");
      return;
    }
    const perm = await prisma.locked_channels.findFirst({
      where: { channel: channel.id },
    });
    if (!perm) {
      await msg.dbReply("Channel isn't locked!");
      return;
    }
    await channel.overwritePermissions(JSON.parse(perm.permissions));
    await (channel as Discord.TextChannel).send('Unlocked!');
    if (channel.id !== msg.channel.id) await msg.dbReply('Unlocked!');
    await Types.LogChannel.tryToLog(msg, `Unlocked ${channel}`);
    await prisma.locked_channels.delete({ where: { channel: channel.id } });
  },
};
const logging = {
  name: 'logging',
  syntax: 'logging <action: "enable" | "disable">',
  explanation: 'Enable or disable logging of actions done by ModBot',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_CHANNELS'),
  version: 2,
  responder: async (
    ctx: Types.Context,
    cmd: { action: 'enable' | 'disable' }
  ) => {
    if (!ctx.msg.guild) return;
    util_functions.assertHasPerms(ctx.msg.guild, ['MANAGE_CHANNELS']);
    if (cmd.action === 'enable') {
      if (await Types.LogChannel.fromGuild(ctx.msg.guild))
        throw new util_functions.BotError('user', 'Logging already enabled');
      const channelName = await util_functions.ask(
        'What should the logging channel be named?',
        60000,
        ctx.msg
      );
      const viewRole = (
        await util_functions.ask(
          'What role should be allowed to view it?',
          60000,
          ctx.msg
        )
      )
        .replace('<@&', '')
        .replace('>', '');
      if (!ctx.msg.guild.roles.cache.get(viewRole))
        throw new util_functions.BotError('user', 'Role not found');
      const createdLogChannel = await ctx.msg.guild.channels.create(
        channelName,
        {
          permissionOverwrites: [
            { id: viewRole, allow: ['VIEW_CHANNEL'] },
            {
              id: ctx.msg.guild.id,
              deny: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_MESSAGES'],
            },
          ],
        }
      );
      await Types.LogChannel.insertChannel(createdLogChannel);
      await ctx.msg.dbReply(
        util_functions.embed(`Created ${createdLogChannel}`, 'success')
      );
      (await Types.LogChannel.fromGuild(ctx.msg.guild))?.log(
        ctx.msg.guild,
        'Enabled ModBot action logging',
        ctx.msg.member
      );
    } else if (cmd.action === 'disable') {
      const logChannel = await Types.LogChannel.fromGuild(ctx.msg.guild);
      if (!logChannel)
        throw new util_functions.BotError('user', 'Logging already disabled');
      await logChannel.log(
        ctx.msg.guild,
        'Disabled ModBot action logging',
        ctx.msg.member
      );
      await logChannel.delete();
      await ctx.msg.dbReply(
        util_functions.embed('Disabled ModBot action logging!', 'success')
      );
    }
  },
};
const disablecommand = {
  name: 'disablecommand',
  syntax: 'disablecommand <command: string>',
  explanation: 'Disable a command in a server',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_MESSAGES'),
  version: 2,
  responder: async (ctx: Context, cmd: { command: string }) => {
    if (
      !ctx.validCommands
        .map((c) => c.toLowerCase())
        .includes(cmd.command.toLowerCase())
    )
      throw new util_functions.BotError('user', 'Command not found');
    if (cmd.command.toLowerCase() === 'enablecommand')
      throw new util_functions.BotError(
        'user',
        "You can't disable that command"
      );
    const commandRealName =
      ctx.validCommands[
        ctx.validCommands
          .map((c) => c.toLowerCase())
          .indexOf(cmd.command.toLowerCase())
      ];
    if (
      (
        await DisabledCommand.query()
          .where('command', commandRealName)
          .where('server', ctx.msg.guild?.id || '')
      ).length
    )
      throw new util_functions.BotError('user', 'Command is already disabled');

    try {
      await DisabledCommand.query().insert({
        server: ctx.msg.guild?.id,
        command: commandRealName,
      });
    } catch (e) {
      throw new util_functions.BotError('user', 'Failed!');
    }
    ctx.msg.dbReply(util_functions.embed('Disabled command!', 'success'));
    await Types.LogChannel.tryToLog(
      ctx.msg,
      `Disabled command \`m: ${commandRealName}\``
    );
  },
};
const enablecommand = {
  name: 'enablecommand',
  syntax: 'enablecommand <command: string>',
  explanation: 'Enable a command in a server',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_MESSAGES'),
  version: 2,
  responder: async (ctx: Context, cmd: { command: string }) => {
    if (
      !ctx.validCommands
        .map((c) => c.toLowerCase())
        .includes(cmd.command.toLowerCase())
    )
      throw new util_functions.BotError('user', 'Command not found');
    const commandRealName =
      ctx.validCommands[
        ctx.validCommands
          .map((c) => c.toLowerCase())
          .indexOf(cmd.command.toLowerCase())
      ];
    if (
      !(
        await DisabledCommand.query()
          .where('command', commandRealName)
          .where('server', ctx.msg.guild?.id || '')
      ).length
    )
      throw new util_functions.BotError('user', 'Command is already enabled');

    try {
      await DisabledCommand.query()
        .delete()
        .where('command', commandRealName)
        .where('server', ctx.msg.guild?.id || '');
    } catch (e) {
      throw new util_functions.BotError('user', 'Failed!');
    }
    ctx.msg.dbReply(util_functions.embed('Enabled command!', 'success'));
    await Types.LogChannel.tryToLog(
      ctx.msg,
      `Enabled command \`m: ${commandRealName}\``
    );
  },
};
exports.commandModule = {
  title: 'Moderation',
  description: 'Helpful uncatergorized moderation commands',
  commands: [lockdown, unlockdown, disablecommand, enablecommand, logging],
};
