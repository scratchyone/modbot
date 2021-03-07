let util_functions = require('../util_functions');
var parse_duration = require('parse-duration');
import * as Types from '../types';
let slowmodeCommand = {
  name: 'slowmode',
  syntax: 'm: slowmode <enable/disable> <CHANNEL>',
  explanation: 'Configure slowmode',
  matcher: (cmd) => cmd.command == 'slowmode',
  simplematcher: (cmd) => cmd[0] === 'slowmode',
  permissions: (msg) => msg.member.hasPermission('MANAGE_MESSAGES'),
  responder: async (msg, cmd) => {
    let channel = msg.guild.channels.cache.get(cmd.channel);
    if (!channel)
      throw new util_functions.BotError('user', "Channel doesn't exist");
    if (cmd.action === 'enable') {
      if ((await Types.Slowmode.query().where('channel', cmd.channel)).length)
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
      await Types.Slowmode.query().insert({
        channel: cmd.channel,
        time: parse_duration(time, 's'),
        delete_mm: delete_mm ? 1 : 0,
      });
      await msg.channel.send(util_functions.desc_embed('Enabled!'));
      await Types.LogChannel.tryToLog(
        msg,
        `Set slowmode of ${time} for <#${cmd.channel}>`
      );
    } else if (cmd.action === 'disable') {
      let channel = msg.guild.channels.cache.get(cmd.channel);
      if (!channel)
        throw new util_functions.BotError('user', "Channel doesn't exist");
      if (!(await Types.Slowmode.query().where('channel', cmd.channel)).length)
        throw new util_functions.BotError('user', "Slowmode isn't enabled");
      for (let sm_user of await Types.SlowmodedUsers.query().where(
        'channel',
        cmd.channel
      ))
        channel.updateOverwrite(sm_user.user, {
          SEND_MESSAGES: true,
        });

      await Types.Slowmode.query().where('channel', cmd.channel).delete();
      await Types.SlowmodedUsers.query().where('channel', cmd.channel).delete();
      await msg.channel.send(util_functions.desc_embed('Disabled!'));
      await Types.LogChannel.tryToLog(
        msg,
        `Disabled slowmode for <#${cmd.channel}>`
      );
    }
  },
};
exports.commandModule = {
  title: 'Slowmode',
  description: "Commands for managing ModBot's slowmode system",
  commands: [slowmodeCommand],
  cog: async (client) => {
    client.on('message', async (msg) => {
      let slowmodeRes = await Types.Slowmode.query()
        .where('channel', msg.channel.id)
        .first();
      if (slowmodeRes && msg.member && !msg.system)
        if (
          (msg.member.hasPermission('MANAGE_MESSAGES') &&
            !slowmodeRes.delete_mm) ||
          !msg.member.hasPermission('MANAGE_MESSAGES')
        ) {
          if (msg.channel.permissionsFor(msg.member).has('SEND_MESSAGES')) {
            try {
              msg.channel.updateOverwrite(msg.member, {
                SEND_MESSAGES: false,
              });
              try {
                await Types.SlowmodedUsers.query().insert({
                  channel: msg.channel.id,
                  user: msg.author.id,
                });
              } catch (e) {
                console.log(e);
              }
              await util_functions.schedule_event(
                {
                  type: 'removeSlowmodePerm',
                  channel: msg.channel.id,
                  user: msg.author.id,
                },
                slowmodeRes.time + 's'
              );
            } catch {}
          }
        }
    });
  },
};
