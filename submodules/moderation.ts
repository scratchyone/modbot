/* eslint-disable @typescript-eslint/no-var-requires */
import * as util_functions from '../util_functions';
const db = require('better-sqlite3')('perms.db3', {});
import Discord from 'discord.js';
import { Command, Context, DisabledCommand } from '../types';
import * as Types from '../types';
const lockdown = {
  name: 'lockdown',
  syntax: 'm: lockdown [TIME]',
  explanation: 'Prevent everyone for sending messages in this channel',
  matcher: (cmd: Command) => cmd.command == 'lockdown',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'lockdown',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_CHANNELS'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: Command,
    client: Discord.Client
  ) => {
    if (cmd.command !== 'lockdown') return;
    if (msg.channel.type !== 'text') return;
    if (!msg.guild) return;
    if (!client.user) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
    if (
      db
        .prepare('SELECT * FROM locked_channels WHERE channel=?')
        .get(msg.channel.id)
    )
      throw new util_functions.BotError(
        'user',
        'Channel is already locked! run `m: unlockdown ' +
          msg.channel +
          '` to unlock'
      );
    if (cmd.time)
      util_functions.schedule_event(
        {
          type: 'unlockdown',
          channel: msg.channel.id,
        },
        cmd.time
      );
    db.prepare('INSERT INTO locked_channels VALUES (?, ?)').run(
      msg.channel.id,
      JSON.stringify(msg.channel.permissionOverwrites)
    );
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
  syntax: 'm: unlockdown <CHANNEL>',
  explanation: 'Unlockdown a channel',
  matcher: (cmd: Command) => cmd.command == 'unlockdown',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'unlockdown',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_CHANNELS'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: Command,
    client: Discord.Client
  ) => {
    if (cmd.command !== 'unlockdown') return;
    if (!msg.guild) return;
    if (!client.user) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
    const channel = msg.guild.channels.cache.get(cmd.channel);
    if (!channel || channel.type !== 'text') {
      await msg.dbReply("Channel doesn't exist!");
      return;
    }
    const perm = db
      .prepare('SELECT * FROM locked_channels WHERE channel=?')
      .get(channel.id);
    if (!perm) {
      await msg.dbReply("Channel isn't locked!");
      return;
    }
    await channel.overwritePermissions(JSON.parse(perm.permissions));
    await (channel as Discord.TextChannel).send('Unlocked!');
    if (channel.id !== msg.channel.id) await msg.dbReply('Unlocked!');
    await Types.LogChannel.tryToLog(msg, `Unlocked ${channel}`);
    db.prepare('DELETE FROM locked_channels WHERE channel=?').run(channel.id);
  },
};
const logging = {
  name: 'logging',
  syntax: 'm: logging <enable/disable>',
  explanation: 'Enable or disable logging of actions done by ModBot',
  matcher: (cmd: Command) => cmd.command == 'logging',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'logging',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_CHANNELS'),
  version: 2,
  responder: async (ctx: Types.Context, cmd: Command) => {
    if (cmd.command !== 'logging' || !ctx.msg.guild) return;
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
  syntax: 'm: disablecommand <COMMAND>',
  explanation: 'Disable a command in a server',
  matcher: (cmd: Command) => cmd.command == 'disablecommand',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'disablecommand',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_MESSAGES'),
  version: 2,
  responder: async (ctx: Context, cmd: Command) => {
    if (cmd.command !== 'disablecommand') return;
    if (
      !ctx.validCommands
        .map((c) => c.toLowerCase())
        .includes(cmd.text.toLowerCase())
    )
      throw new util_functions.BotError('user', 'Command not found');
    if (cmd.text.toLowerCase() === 'enablecommand')
      throw new util_functions.BotError(
        'user',
        "You can't disable that command"
      );
    const commandRealName =
      ctx.validCommands[
        ctx.validCommands
          .map((c) => c.toLowerCase())
          .indexOf(cmd.text.toLowerCase())
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
  syntax: 'm: enablecommand <COMMAND>',
  explanation: 'Enable a command in a server',
  matcher: (cmd: Command) => cmd.command == 'enablecommand',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'enablecommand',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_MESSAGES'),
  version: 2,
  responder: async (ctx: Context, cmd: Command) => {
    if (cmd.command !== 'enablecommand') return;
    if (
      !ctx.validCommands
        .map((c) => c.toLowerCase())
        .includes(cmd.text.toLowerCase())
    )
      throw new util_functions.BotError('user', 'Command not found');
    const commandRealName =
      ctx.validCommands[
        ctx.validCommands
          .map((c) => c.toLowerCase())
          .indexOf(cmd.text.toLowerCase())
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
