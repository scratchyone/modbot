import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import Discord, { Snowflake, TextChannel } from 'discord.js';
import * as util_functions from '../util_functions.js';
import * as Types from '../types.js';
const setupmute = {
  name: 'setupmute',
  syntax: 'setupmute',
  explanation: 'Configure mutes',
  long_explanation:
    'Create/Delete the mute role, and fix its channel permissions if they get changed',
  permissions: (msg: Discord.Message) =>
    msg.member?.permissions.has('MANAGE_ROLES'),
  responder: async (msg: util_functions.EMessage) => {
    if (!msg.guild) return;
    if (
      !(await prisma.mute_roles.findFirst({ where: { server: msg.guild.id } }))
    ) {
      const res = await util_functions.embed_options(
        'What do you want to setup?',
        ['Create Mute Role'],
        ['🔨'],
        msg
      );
      if (res === 0) {
        util_functions.assertHasPerms(msg.guild, [
          'MANAGE_ROLES',
          'MANAGE_CHANNELS',
        ]);
        await msg.channel.send('What should the mute role be named?');
        const rolename = await msg.channel.awaitMessages({
          max: 1,
          time: 20000,
          filter: (m) => m.author.id == msg.author.id,
        });
        if (![...rolename.values()].length) {
          await msg.channel.send(util_functions.desc_embed('Timed out'));
          return;
        }
        let mute_role;
        try {
          mute_role = await msg.guild.roles.create({
            name: [...rolename.values()][0].content,
            reason: 'Created mute role',
          });
        } catch (e) {
          throw new util_functions.BotError(
            'bot',
            'Failed to create mute role!'
          );
        }
        await msg.channel.send(
          util_functions.desc_embed('Setting channel overrides')
        );
        const guild_channels = [...msg.guild.channels.cache.values()];
        for (const channel of guild_channels) {
          try {
            await (channel as TextChannel).permissionOverwrites.edit(
              mute_role,
              {
                SEND_MESSAGES: false,
                ADD_REACTIONS: false,
              }
            );
          } catch (e) {
            await msg.channel.send(
              util_functions.desc_embed(
                `Warning: Could not setup mute role in ${channel}. This likely means ModBot's permissions have an issue`
              )
            );
          }
        }
        await prisma.mute_roles.create({
          data: {
            role: mute_role.id,
            server: msg.guild.id,
          },
        });
        await msg.channel.send(
          util_functions.desc_embed(`Created ${mute_role}`)
        );
        await Types.LogChannel.tryToLog(msg, `Created mute role ${mute_role}`);
      }
    } else {
      const res = await util_functions.embed_options(
        'What do you want to setup?',
        ['Remove Mute Role', 'Fix Mute Role Channel Overrides'],
        ['🗑️', '🔨'],
        msg
      );
      if (res === 0) {
        util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
        const conf = await util_functions.confirm(msg);
        if (conf) {
          const mute_role_db = await prisma.mute_roles.findFirst({
            where: {
              server: msg.guild.id,
            },
          });
          const mute_role = msg.guild.roles.cache.get(
            mute_role_db!.role as Snowflake
          );
          try {
            if (mute_role) await mute_role.delete();
          } catch (e) {}
          await prisma.mute_roles.deleteMany({
            where: {
              server: msg.guild.id,
            },
          });
          await msg.channel.send(
            util_functions.desc_embed('Deleted mute role and unmuted all')
          );
          await Types.LogChannel.tryToLog(
            msg,
            'Deleted mute role and unmuted everyone'
          );
        }
      } else if (res === 1) {
        util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
        const mute_role_db = await prisma.mute_roles.findFirst({
          where: {
            server: msg.guild.id,
          },
        });
        const mute_role = msg.guild.roles.cache.get(
          mute_role_db!.role as Snowflake
        );
        const guild_channels = [...msg.guild.channels.cache.values()];
        for (const channel of guild_channels) {
          try {
            await (channel as Discord.TextChannel).permissionOverwrites.edit(
              mute_role!,
              {
                SEND_MESSAGES: false,
              }
            );
          } catch (e) {
            await msg.channel.send(
              util_functions.desc_embed(
                `Warning: Could not setup mute role in ${channel}. This likely means ModBot's permissions have an issue`
              )
            );
          }
        }
        await msg.channel.send(
          util_functions.desc_embed(`Updated permissions for ${mute_role}`)
        );
        await Types.LogChannel.tryToLog(
          msg,
          `Updated channel permissions for mute role ${mute_role}`
        );
      }
    }
  },
};
function checkChannelsThingCanTalkIn(
  guild: Discord.Guild,
  member: Discord.GuildMember | Discord.Role
) {
  return [...guild.channels.cache.values()].filter(
    (channel) =>
      channel.permissionsFor(member).has('SEND_MESSAGES') &&
      channel.permissionsFor(member).has('VIEW_CHANNEL')
  );
}
function checkChannelsThingCanTalkInAlways(
  guild: Discord.Guild,
  thing: Discord.GuildMember | Discord.Role
) {
  return [...guild.channels.cache.values()].filter((channel) => {
    const po = (channel as Discord.TextChannel).permissionOverwrites.cache.get(
      thing.id
    );
    return po ? po.allow.has('SEND_MESSAGES') : false;
  });
}
import parse_duration from 'parse-duration';
const mute = {
  name: 'mute',
  syntax: 'mute <user: user_id> [duration: word] [reason: string]',
  explanation: 'Mute a user',
  long_explanation:
    'Mute a user. [DURATION] is an optional duration in the form `5m`',
  permissions: (msg: Discord.Message) =>
    msg.member?.permissions.has('MANAGE_ROLES'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: {
      user: string;
      duration: string | undefined;
      reason: string | undefined;
    },
    client: Discord.Client
  ) => {
    if (!msg.guild) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
    if (cmd.user === client.user?.id) {
      await msg.dbReply('fuck you');
      await msg.dbReply('<a:dance:759943179175854100>');
      return;
    }
    try {
      await msg.delete();
    } catch {}
    if (
      await prisma.mute_roles.findFirst({
        where: {
          server: msg.guild.id,
        },
      })
    ) {
      const mute_role_db = await prisma.mute_roles.findFirst({
        where: {
          server: msg.guild.id,
        },
      });
      const mute_role = msg.guild.roles.cache.get(
        mute_role_db!.role as Snowflake
      );
      const mutee = msg.guild.members.cache.get(cmd.user as Snowflake);
      if (mutee!.roles.highest.position >= msg.member!.roles.highest.position) {
        await msg.channel.send(
          util_functions.desc_embed(
            'The user you are trying to mute is either above you or at the same level as you. You must be above them to mute'
          )
        );
      } else {
        mutee!.roles.add(mute_role!);
        if (cmd.duration && parse_duration(cmd.duration, 's')) {
          await util_functions.schedule_event(
            {
              type: 'unmute',
              channel: msg.channel.id,
              user: mutee!.id,
              server: msg.guild.id,
              role: mute_role!.id,
            },
            cmd.duration
          );
          await msg.channel.send(
            util_functions.desc_embed(`Muted ${mutee} for ${cmd.duration}`)
          );
          await Types.LogChannel.tryToLog(
            msg,
            `Muted ${mutee} for ${cmd.duration}${
              cmd.reason ? ` for the following reason: ${cmd.reason}` : ''
            }`
          );
        } else {
          await msg.channel.send(
            util_functions.desc_embed(`Muted ${mutee} indefinitely`)
          );
          await Types.LogChannel.tryToLog(
            msg,
            `Muted ${mutee} indefinitely${
              cmd.reason ? ` for the following reason: ${cmd.reason}` : ''
            }`
          );
        }
        try {
          await mutee!.send({
            embeds: [
              new Discord.MessageEmbed()
                .setAuthor({
                  name: msg.guild.name,
                  iconURL: msg.guild.iconURL() || undefined,
                })
                .setColor(util_functions.COLORS.warning)
                .setTitle(`Muted in ${msg.guild.name}`)
                .setDescription(
                  `You have been muted ${
                    cmd.duration && parse_duration(cmd.duration, 's')
                      ? `for ${cmd.duration}.`
                      : 'indefinitely.'
                  }`
                )
                .addFields(
                  cmd.reason ? [{ name: 'Reason:', value: cmd.reason }] : []
                ),
            ],
          });
        } catch (e) {}
        const userCanTalkIn = checkChannelsThingCanTalkIn(msg.guild, mutee!);
        if (userCanTalkIn.length > 0) {
          if (
            await prisma.alert_channels.findFirst({
              where: {
                server: msg.guild.id,
              },
            })
          ) {
            try {
              let reason = '';
              if (checkChannelsThingCanTalkIn(msg.guild, mute_role!).length) {
                const chans = checkChannelsThingCanTalkIn(
                  msg.guild,
                  mute_role!
                );
                reason += `In ${chans.join(
                  ' and '
                )}, the mute role isn't setup. To fix this, run the command \`m: setupmute\` and select the "Fix Mute Role Channel Overrides" option.\n`;
              }
              const role_allows = [];
              for (const role of [...mutee!.roles.cache.values()]) {
                if (
                  checkChannelsThingCanTalkInAlways(msg.guild, role).length &&
                  role.id !== msg.guild.id
                ) {
                  const chans = checkChannelsThingCanTalkInAlways(
                    msg.guild,
                    role
                  );
                  role_allows.push({ role: role, chans: chans });
                }
              }
              for (const allow of role_allows) {
                reason += `In ${allow.chans.join(' and ')}, ${
                  allow.role
                } has a permission override. You can fix this in the channel settings\n`;
              }
              if (checkChannelsThingCanTalkInAlways(msg.guild, mutee!).length) {
                const chans = checkChannelsThingCanTalkInAlways(
                  msg.guild,
                  mutee!
                );
                reason += `In ${chans.join(
                  ' and '
                )}, ${mutee} has a permission override. You can fix this in the channel settings\n`;
              }
              await (
                msg.guild.channels.cache.get(
                  (await prisma.alert_channels.findFirst({
                    where: {
                      server: msg.guild.id,
                    },
                  }))!.channel as Snowflake
                )! as Discord.TextChannel
              ).send({
                content: `${msg.author}`,
                embeds: util_functions.desc_embed(
                  `Warning: Muted user ${mutee} can still talk in ${userCanTalkIn.join(
                    ' and '
                  )}.\nReasons:\n${reason}`
                ).embeds,
              });
            } catch (e) {
              console.log(e);
            }
          }
        }
      }
    } else {
      await msg.channel.send(
        util_functions.desc_embed(
          'No mute role! Create one with `m: setupmute`'
        )
      );
    }
  },
};
const unmute = {
  name: 'unmute',
  syntax: 'unmute <user: user_id>',
  explanation: 'Unmute a user',
  long_explanation: 'Unmute a user',
  permissions: (msg: Discord.Message) =>
    msg.member?.permissions.has('MANAGE_ROLES'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: {
      user: string;
    }
  ) => {
    if (!msg.guild || !msg.member) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
    if (
      await prisma.mute_roles.findFirst({
        where: {
          server: msg.guild.id,
        },
      })
    ) {
      const mute_role_db = await prisma.mute_roles.findFirst({
        where: {
          server: msg.guild.id,
        },
      });
      if (!mute_role_db)
        throw new util_functions.BotError('user', "Couldn't find mute role");
      const mute_role = msg.guild.roles.cache.get(
        mute_role_db.role as Snowflake
      );
      const mutee = msg.guild.members.cache.get(cmd.user as Snowflake);
      if (!mutee)
        throw new util_functions.BotError('user', "Couldn't find mutee");
      if (mutee.roles.highest.position >= msg.member.roles.highest.position) {
        await msg.channel.send(
          util_functions.desc_embed(
            'The user you are trying to unmute is either above you or at the same level as you. You must be above them to unmute'
          )
        );
      } else {
        if (!mute_role)
          throw new util_functions.BotError('user', "Couldn't find mute role");
        await mutee.roles.remove(mute_role);
        await msg.channel.send(util_functions.desc_embed(`Unmuted ${mutee}`));
        await Types.LogChannel.tryToLog(msg, `Unmuted ${mutee}`);
      }
    } else {
      await msg.channel.send(
        util_functions.desc_embed(
          'No mute role! Create one with `m: setupmute`'
        )
      );
    }
  },
};
export const onChannelCreate = async (channel: Discord.TextChannel) => {
  const mr = await prisma.mute_roles.findFirst({
    where: { server: channel.guild.id },
  });

  if (mr) {
    const mute_role = channel.guild.roles.cache.get(mr.role as Snowflake);
    channel.permissionOverwrites.edit(mute_role!, {
      SEND_MESSAGES: false,
      ADD_REACTIONS: false,
    });
  }
};
export const commandModule = {
  title: 'Mutes',
  description:
    'Commands related to muting people and configuring the mute role',
  commands: [setupmute, mute, unmute],
};
