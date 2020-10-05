/* eslint-disable @typescript-eslint/no-var-requires */
const util_functions = require('../util_functions');
const db = require('better-sqlite3')('perms.db3', {});
import Discord from 'discord.js';
import { Command } from '../types';
const lockdown = {
  name: 'lockdown',
  syntax: 'm: lockdown [TIME]',
  explanation: 'Prevent everyone for sending messages in this channel',
  matcher: (cmd: Command) => cmd.command == 'lockdown',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'lockdown',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_CHANNELS'),
  responder: async (
    msg: Discord.Message,
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
    try {
      for (const perm of msg.channel.permissionOverwrites) {
        await msg.channel.updateOverwrite(perm[0], { SEND_MESSAGES: false });
      }
      await msg.channel.updateOverwrite(msg.guild.id, { SEND_MESSAGES: false });
      await msg.channel.updateOverwrite(client.user.id, {
        SEND_MESSAGES: true,
      });
    } catch (e) {
      await msg.channel.send(
        'Warning: An error has occured. Channel permissions might be messed up!'
      );
      throw e;
    }
    await msg.channel.send('Locked!');
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
    msg: Discord.Message,
    cmd: Command,
    client: Discord.Client
  ) => {
    if (cmd.command !== 'unlockdown') return;
    if (!msg.guild) return;
    if (!client.user) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
    const channel = msg.guild.channels.cache.get(cmd.channel);
    if (!channel || channel.type !== 'text') {
      await msg.channel.send("Channel doesn't exist!");
      return;
    }
    const perm = db
      .prepare('SELECT * FROM locked_channels WHERE channel=?')
      .get(channel.id);
    if (!perm) {
      await msg.channel.send("Channel isn't locked!");
      return;
    }
    await channel.overwritePermissions(JSON.parse(perm.permissions));
    await (channel as Discord.TextChannel).send('Unlocked!');
    if (channel.id !== msg.channel.id) await msg.channel.send('Unlocked!');
    db.prepare('DELETE FROM locked_channels WHERE channel=?').run(channel.id);
  },
};
exports.commandModule = {
  title: 'Moderation',
  description: 'Helpful uncatergorized moderation commands',
  commands: [lockdown, unlockdown],
};
