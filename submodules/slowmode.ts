import * as util_functions from '../util_functions.js';
import Discord, { Snowflake } from 'discord.js';
import parse_duration from 'parse-duration';
import * as Types from '../types.js';
const slowmodeCommand = {
  name: 'slowmode',
  syntax: 'slowmode <action: "enable" | "disable"> <channel: channel_id>',
  explanation: 'Configure slowmode',
  permissions: (msg: Discord.Message) =>
    msg.member?.permissions.has('MANAGE_MESSAGES'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: { action: 'enable' | 'disable'; channel: string }
  ) => {
    const channel = msg.guild?.channels.cache.get(cmd.channel as Snowflake);
    if (!channel)
      throw new util_functions.BotError('user', "Channel doesn't exist");
    if (cmd.action === 'enable') {
      if ((await Types.Slowmode.query().where('channel', cmd.channel)).length)
        throw new util_functions.BotError(
          'user',
          'Slowmode is already enabled'
        );
      const delete_mm = !!(await util_functions.embed_options(
        'Should this slowmode also apply to users with the MANAGE_MESSAGES permission?',
        ['Yes', 'No'],
        ['✅', '❌'],
        msg
      ));
      const time = await util_functions.ask(
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
      const channel = msg.guild?.channels.cache.get(cmd.channel as Snowflake);
      if (!channel)
        throw new util_functions.BotError('user', "Channel doesn't exist");
      if (!(await Types.Slowmode.query().where('channel', cmd.channel)).length)
        throw new util_functions.BotError('user', "Slowmode isn't enabled");
      for (const sm_user of await Types.SlowmodedUsers.query().where(
        'channel',
        cmd.channel
      ))
        (channel as Discord.TextChannel).permissionOverwrites.edit(
          sm_user.user as Snowflake,
          {
            SEND_MESSAGES: true,
          }
        );

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
export const commandModule = {
  title: 'Slowmode',
  description: "Commands for managing ModBot's slowmode system",
  commands: [slowmodeCommand],
  cog: async (client: Discord.Client) => {
    client.on('messageCreate', async (msg) => {
      const slowmodeRes = await Types.Slowmode.query()
        .where('channel', msg.channel.id)
        .first();
      if (slowmodeRes && msg.member && !msg.system)
        if (
          (msg.member.permissions.has('MANAGE_MESSAGES') &&
            !slowmodeRes.delete_mm) ||
          !msg.member.permissions.has('MANAGE_MESSAGES')
        ) {
          if (
            (msg.channel as Discord.TextChannel)
              .permissionsFor(msg.member)
              .has('SEND_MESSAGES')
          ) {
            try {
              (msg.channel as Discord.TextChannel).permissionOverwrites.edit(
                msg.member,
                {
                  SEND_MESSAGES: false,
                }
              );

              try {
                if (
                  (
                    await Types.SlowmodedUsers.query().where({
                      channel: msg.channel.id,
                      user: msg.author.id,
                    })
                  ).length == 0
                )
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
