let util_functions = require('../util_functions.js');
const db = require('better-sqlite3')('perms.db3', {});
var parse_duration = require('parse-duration');
let slowmodeCommand = {
  name: 'slowmode',
  syntax: 'm: slowmode <enable/disable> <CHANNEL>',
  explanation: 'Configure slowmode',
  matcher: (cmd) => cmd.command == 'slowmode',
  permissions: (msg) => msg.member.hasPermission('MANAGE_MESSAGES'),
  responder: async (msg, cmd) => {
    let channel = msg.guild.channels.cache.get(cmd.channel);
    if (!channel)
      throw new util_functions.BotError('user', "Channel doesn't exist");
    if (cmd.action === 'enable') {
      if (
        db.prepare('SELECT * FROM slowmodes WHERE channel=?').get(cmd.channel)
      )
        throw new util_functions.BotError(
          'user',
          'Slowmode is already enabled'
        );
      let delete_mm = !!(await util_functions.embed_options(
        'Should this slowmode also apply to users with the MANAGE_MESSAGES permission?',
        ['Yes', 'No'],
        ['✅', '❌'],
        msg
      ));
      let time = await util_functions.ask(
        'How long should the slowmode be? Must be more than 30 seconds',
        20000,
        msg
      );
      try {
        parse_duration(time, 's');
        if (parse_duration(time, 's') <= 30)
          throw new util_functions.BotError(
            'user',
            'Time must be greater than 30 seconds'
          );
      } catch (e) {
        throw new util_functions.BotError('user', e);
      }
      db.prepare('INSERT INTO slowmodes VALUES (?, ?, ?)').run(
        cmd.channel,
        parse_duration(time, 's'),
        delete_mm ? 1 : 0
      );
      await msg.channel.send(util_functions.desc_embed('Enabled!'));
    } else if (cmd.action === 'disable') {
      let channel = msg.guild.channels.cache.get(cmd.channel);
      if (!channel)
        throw new util_functions.BotError('user', "Channel doesn't exist");
      if (
        !db.prepare('SELECT * FROM slowmodes WHERE channel=?').get(cmd.channel)
      )
        throw new util_functions.BotError('user', "Slowmode isn't enabled");
      for (let sm_user of db
        .prepare('SELECT * FROM slowmoded_users WHERE channel=?')
        .all(cmd.channel))
        channel.updateOverwrite(sm_user.user, {
          SEND_MESSAGES: true,
        });
      db.prepare('DELETE FROM slowmodes WHERE channel=?').run(cmd.channel);
      db.prepare('DELETE FROM slowmoded_users WHERE channel=?').run(
        cmd.channel
      );
      await msg.channel.send(util_functions.desc_embed('Disabled!'));
    }
  },
};
let getChannelSlowmode = db.prepare('SELECT * FROM slowmodes WHERE channel=?');
exports.onMessage = async (msg) => {
  let slowmodeRes = getChannelSlowmode.get(msg.channel.id);
  if (slowmodeRes)
    if (
      (msg.member.hasPermission('MANAGE_MESSAGES') && !slowmodeRes.delete_mm) ||
      !msg.member.hasPermission('MANAGE_MESSAGES')
    ) {
      if (msg.channel.permissionsFor(msg.member).has('SEND_MESSAGES')) {
        msg.channel.updateOverwrite(msg.member, {
          SEND_MESSAGES: false,
        });
        try {
          db.prepare('INSERT INTO slowmoded_users VALUES (?, ?)').run(
            msg.channel.id,
            msg.author.id
          );
        } catch (e) {
          console.log(e);
        }
        util_functions.schedule_event(
          {
            type: 'removeSlowmodePerm',
            channel: msg.channel.id,
            user: msg.author.id,
          },
          slowmodeRes.time + 's'
        );
      }
    }
};
exports.commandModule = {
  title: 'Slowmode',
  description: "Commands for managing ModBot's slowmode system",
  commands: [slowmodeCommand],
};
