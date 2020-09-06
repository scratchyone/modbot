let util_functions = require('../util_functions.js');
let lockdown = {
  name: 'lockdown',
  syntax: 'm: lockdown <TIME>',
  explanation: 'Prevent everyone for sending messages in this channel',
  matcher: (cmd) => cmd.command == 'lockdown',
  permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
  responder: async (msg, cmd, client) => {
    util_functions.schedule_event(
      {
        type: 'overwriteChannelPermissions',
        message: `Unlocked!`,
        channel: msg.channel.id,
        overrides: msg.channel.permissionOverwrites,
      },
      cmd.time
    );
    for (let perm of msg.channel.permissionOverwrites) {
      await msg.channel.updateOverwrite(perm[0], { SEND_MESSAGES: false });
    }
    await msg.channel.send('Locked!');
  },
};

exports.commandModule = {
  title: 'Moderation',
  description: 'Helpful uncatergorized moderation commands',
  commands: [lockdown],
};
