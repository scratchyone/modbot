/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-var-requires */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import Discord, { Snowflake } from 'discord.js';
import * as util_functions from '../util_functions';
import * as Types from '../types';
const automod = {
  name: 'automod',
  syntax: 'automod <action: "enable" | "disable" | "add" | "remove" | "list">',
  explanation:
    'Enable/Disable the automod, Add/Remove automod triggers, and list all configured triggers. You can use m: inspect to view more info about a specific trigger',
  permissions: (msg: Discord.Message) =>
    msg.member?.permissions.has('MANAGE_MESSAGES'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: { action: 'enable' | 'disable' | 'add' | 'remove' | 'list' },
    client: Discord.Client
  ) => {
    if (!msg.guild || !client.user || !msg.member) return;
    util_functions.assertHasPerms(msg.guild, [
      'MANAGE_CHANNELS',
      'MANAGE_MESSAGES',
      'MANAGE_ROLES',
    ]);
    if (cmd.action === 'enable') {
      if (
        await prisma.automods.findFirst({
          where: { server: msg.guild.id },
        })
      )
        throw new util_functions.BotError(
          'user',
          'AutoMod is already enabled, you can disable it with `m: automod disable`'
        );
      const channelname = await util_functions.ask(
        'What should the AutoMod punishment log channel be named?',
        10000,
        msg
      );
      const channelViewRole = msg.guild.roles.cache.get(
        (
          await util_functions.ask(
            'What role should be able to see it?',
            10000,
            msg
          )
        )
          .replace('<@&', '')
          .replace('>', '') as Snowflake
      );
      if (!channelViewRole)
        throw new util_functions.BotError('user', "That role doesn't exist");
      const channel = await msg.guild.channels.create(channelname, {
        type: 'GUILD_TEXT',
        permissionOverwrites: [
          {
            id: msg.guild.id,
            deny: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
          },
          {
            id: channelViewRole,
            allow: ['VIEW_CHANNEL'],
          },
          {
            id: client.user.id,
            allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
          },
        ],
      });
      await channel.send(
        util_functions.desc_embed('Created AutoMod deletion log channel!')
      );
      await prisma.automods.create({
        data: {
          server: msg.guild.id,
          channel: channel.id,
        },
      });
      await msg.channel.send(
        util_functions.desc_embed(
          `Created ${channel} and enabled automod! Add some triggers with \`m: automod add\``
        )
      );
      await Types.LogChannel.tryToLog(
        msg,
        `Created ${channel} and enabled automod`
      );
    } else if (cmd.action === 'disable') {
      if (
        !(await prisma.automods.findFirst({
          where: {
            server: msg.guild.id,
          },
        }))
      )
        throw new util_functions.BotError(
          'user',
          'AutoMod is already disabled, you can enable it with `m: automod enable`'
        );
      await prisma.automods.deleteMany({
        where: {
          server: msg.guild.id,
        },
      });
      await prisma.automod_triggers.deleteMany({
        where: {
          server: msg.guild.id,
        },
      });
      await msg.channel.send(
        util_functions.desc_embed('Disabled AutoMod and deleted all triggers!')
      );
      await Types.LogChannel.tryToLog(
        msg,
        'Disabled AutoMod and deleted all triggers'
      );
    } else if (cmd.action === 'add') {
      if (
        !(await prisma.automods.findFirst({
          where: {
            server: msg.guild.id,
          },
        }))
      )
        throw new util_functions.BotError(
          'user',
          'AutoMod is not enabled, you can enable it with `m: automod enable`'
        );
      const triggerName = await util_functions.ask(
        'What should the trigger be named?',
        10000,
        msg
      );
      const triggerRegex = await util_functions.ask(
        'What should the regex be ( https://regexr.com/ )?',
        40000,
        msg
      );
      const triggerMessage = await util_functions.ask(
        'What should AutoMod say when this trigger is activated?',
        40000,
        msg
      );
      const punishment = await util_functions.embed_options(
        'What should the punishment be?',
        ['Only reply', 'Reply and delete', 'Reply, delete, and mute'],
        ['💬', '🗑️', '🤐'],
        msg
      );
      let punishments;
      if (punishment === null)
        throw new util_functions.BotError('user', 'Timed out!');
      if (punishment === 0) {
        punishments = [{ action: 'reply', message: triggerMessage }];
      } else if (punishment === 1) {
        punishments = [
          { action: 'reply', message: triggerMessage },
          { action: 'delete' },
        ];
      } else if (punishment === 2) {
        const muteDur = await util_functions.ask(
          'How long should the user be muted?',
          10000,
          msg
        );
        punishments = [
          { action: 'reply', message: triggerMessage },
          { action: 'delete' },
          { action: 'mute', time: muteDur },
        ];
      }
      await msg.channel.send(
        util_functions.desc_embed(
          'Warning: This trigger will only apply to people below you in the role list'
        )
      );
      await prisma.automod_triggers.create({
        data: {
          server: msg.guild.id,
          setuprole: msg.member.roles.highest.id,
          name: triggerName,
          regex: triggerRegex,
          punishments: JSON.stringify(punishments),
        },
      });
      await msg.channel.send(util_functions.desc_embed('Trigger added!'));
      await Types.LogChannel.tryToLog(
        msg,
        `Added AutoMod trigger \`${triggerName}\``
      );
    } else if (cmd.action === 'remove') {
      const triggerName = await util_functions.ask(
        'What is the name of the trigger you would like to remove?',
        10000,
        msg
      );
      const res = await prisma.automod_triggers.deleteMany({
        where: {
          server: msg.guild.id,
          name: triggerName,
        },
      });
      if (res.count == 0)
        throw new util_functions.BotError('user', 'Trigger not found');
      await msg.channel.send(util_functions.desc_embed('Trigger removed!'));
      await Types.LogChannel.tryToLog(
        msg,
        `Removed AutoMod trigger \`${triggerName}\``
      );
    } else if (cmd.action === 'list') {
      const triggers =
        (
          await prisma.automod_triggers.findMany({
            where: { server: msg.guild.id },
          })
        )
          .map((n) => n.name)
          .join('\n') || 'No Triggers Configured Yet';
      await msg.channel.send(util_functions.desc_embed(triggers));
    } else if (cmd.action === 'inspect') {
      const triggerName = await util_functions.ask(
        'What is the name of the trigger you would like to inspect?',
        10000,
        msg
      );
      const trigger = await prisma.automod_triggers.findFirst({
        where: {
          server: msg.guild.id,
          name: triggerName,
        },
      });
      if (!trigger)
        throw new util_functions.BotError('user', 'Trigger not found');
      await msg.channel.send({
        embeds: [
          new Discord.MessageEmbed()
            .setTitle(triggerName)
            .addField('Regex', trigger.regex)
            .addField('Role that setup trigger', `<@&${trigger.setuprole}>`)
            .addField(
              'Punishments',
              JSON.parse(trigger.punishments)
                .map((p: any) => {
                  if (p.action === 'delete') {
                    return 'Delete message';
                  }
                  if (p.action === 'reply') {
                    return `Reply to message saying "${p.message}"`;
                  }
                  if (p.action === 'mute') {
                    return `Mute user for ${p.time}`;
                  }
                })
                .join(', ')
            ),
        ],
      });
    }
  },
};
exports.checkForTriggers = async (msg: util_functions.EMessage) => {
  if (!msg.guild) return;
  const am = await prisma.automods.findFirst({
    where: {
      server: msg.guild.id,
    },
  });
  if (am && msg.channel.id != am.channel) {
    const triggers = await prisma.automod_triggers.findMany({
      where: {
        server: msg.guild.id,
      },
    });
    for (const trigger of triggers) {
      const match = trigger.regex.match(new RegExp('^/(.*?)/([gimy]*)$'));
      // sanity check here
      const re = match
        ? new RegExp(match[1], match[2])
        : new RegExp(trigger.regex);
      if (re.test(msg.content)) {
        const role = msg.guild.roles.cache.get(trigger.setuprole as Snowflake);
        if (!role) {
          msg.channel.send(
            util_functions.desc_embed(
              `Error: Role used to setup ${trigger.name} no longer exists`
            )
          );
          return;
        }
        const realMember = await msg.getRealMember();
        if (
          realMember ? realMember.roles.highest.position < role.position : true
        ) {
          const punishments_sorted = JSON.parse(trigger.punishments);
          punishments_sorted.sort((x: any) => (x.action === 'delete' ? -1 : 0));
          for (const punishment of JSON.parse(trigger.punishments)) {
            if (punishment.action === 'delete') {
              try {
                await msg.delete();
              } catch (e) {}
            }
            if (
              !(await msg.isPluralKitMessage()) &&
              !(await msg.isAnonMessage())
            )
              if (punishment.action === 'reply') {
                await msg.channel.send(`${msg.author}, ${punishment.message}`);
              }
            if (
              !(await msg.isPluralKitMessage()) &&
              !(await msg.isAnonMessage())
            )
              if (punishment.action === 'mute' && msg.member) {
                const mute_role_db = await prisma.mute_roles.findFirst({
                  where: {
                    server: msg.guild.id,
                  },
                });

                if (mute_role_db) {
                  const mute_role = msg.guild.roles.cache.get(
                    mute_role_db.role as Snowflake
                  );
                  if (!mute_role) return;
                  const mutee = msg.member;
                  mutee.roles.add(mute_role);

                  await util_functions.schedule_event(
                    {
                      type: 'unmute',
                      channel: msg.channel.id,
                      user: mutee.id,
                      server: msg.guild.id,
                      role: mute_role.id,
                    },
                    punishment.time
                  );
                  await msg.channel.send(
                    util_functions.desc_embed(
                      `Muted ${mutee} for ${punishment.time}`
                    )
                  );
                } else {
                  msg.channel.send(
                    util_functions.desc_embed(
                      "Mute role doesn't exist, could not mute user"
                    )
                  );
                }
              }
          }
          const channel = msg.guild.channels.cache.get(
            am.channel as Snowflake
          ) as Discord.TextChannel | undefined;
          if (!channel) {
            msg.channel.send(
              util_functions.desc_embed("Error: Log channel doesn't exist")
            );
            return;
          }
          const loghook = await channel.createWebhook(
            msg.member ? msg.member.displayName : msg.author.username,
            {
              avatar: msg.author.displayAvatarURL(),
            }
          );
          await loghook.send({
            content: await util_functions.cleanPings(msg.content, msg.guild),
            embeds: [
              new Discord.MessageEmbed().setTitle('Punished').setDescription(
                `Author: ${msg.author}\n` +
                  JSON.parse(trigger.punishments)
                    .map((p: any) => {
                      if (p.action === 'delete') {
                        return 'Deleted message';
                      }
                      if (p.action === 'reply') {
                        return `Replied to message saying "${p.message}"`;
                      }
                      if (p.action === 'mute') {
                        return `Muted user for ${p.time}`;
                      }
                    })
                    .join(', ')
              ),
            ],
          });
          await loghook.delete();
        }
      }
    }
  }
};
exports.commandModule = {
  title: 'AutoMod',
  description: 'Commands related to configuring the AutoModerator',
  commands: [automod],
};
