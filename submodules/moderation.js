let util_functions = require('../util_functions.js');
const db = require('better-sqlite3')('perms.db3', {});
let lockdown = {
  name: 'lockdown',
  syntax: 'm: lockdown [TIME]',
  explanation: 'Prevent everyone for sending messages in this channel',
  matcher: (cmd) => cmd.command == 'lockdown',
  permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
  responder: async (msg, cmd, client) => {
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
    for (let perm of msg.channel.permissionOverwrites) {
      await msg.channel.updateOverwrite(perm[0], { SEND_MESSAGES: false });
    }
    await msg.channel.updateOverwrite(msg.guild.id, { SEND_MESSAGES: false });
    await msg.channel.updateOverwrite(client.user.id, { SEND_MESSAGES: true });
    await msg.channel.send('Locked!');
  },
};
let unlockdown = {
  name: 'lockdown',
  syntax: 'm: unlockdown <CHANNEL>',
  explanation: 'Unlockdown a channel',
  matcher: (cmd) => cmd.command == 'unlockdown',
  permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
  responder: async (msg, cmd, client) => {
    let channel = msg.guild.channels.cache.get(cmd.channel);
    if (!channel) {
      await msg.channel.send("Channel doesn't exist!");
      return;
    }
    let perm = db
      .prepare('SELECT * FROM locked_channels WHERE channel=?')
      .get(channel.id);
    if (!perm) {
      await msg.channel.send("Channel isn't locked!");
      return;
    }
    await channel.overwritePermissions(JSON.parse(perm.permissions));
    await channel.send('Unlocked!');
    if (channel.id !== msg.channel.id) await msg.channel.send('Unlocked!');
    db.prepare('DELETE FROM locked_channels WHERE channel=?').run(channel.id);
  },
};
exports.commandModule = {
  title: 'Moderation',
  description: 'Helpful uncatergorized moderation commands',
  commands: [lockdown, unlockdown],
};
