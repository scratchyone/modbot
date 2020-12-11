/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-var-requires */
import Discord from 'discord.js';
import moment from 'moment';
const Sentry = require('@sentry/node');
import SentryTypes from '@sentry/types';
import { Model } from 'objection';
import Knex from 'knex';
import KeyValueStore from './kvs';
import * as AutoResponders from './autoresponders';
const store = new KeyValueStore();
// Initialize knex.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const knex = Knex(Object.values(require('./knexfile'))[0] as Knex.Config<any>);
// Give the knex instance to objection.
Model.knex(knex);
require('dotenv').config();
import * as Web from './web';
Sentry.init({
  dsn: process.env.SENTRY_TOKEN,
  beforeSend: (event: SentryTypes.Event) => {
    if (!process.env.SENTRY_TOKEN) {
      console.error(event);
      return null; // this drops the event and nothing will be send to sentry
    }
    return event;
  },
});
moment.relativeTimeThreshold('ss', 15);
const parse_duration = require('parse-duration');

const nodefetch = require('node-fetch');
const nearley = require('nearley');
const commands = require('./commands.js');
const mutes = (() => {
  try {
    return require('./submodules/mutes.js');
  } catch (e) {
    return undefined;
  }
})();
const alertchannels = (() => {
  try {
    return require('./submodules/alertchannels.js');
  } catch (e) {
    return undefined;
  }
})();
const automod = (() => {
  try {
    return require('./submodules/automod.js');
  } catch (e) {
    return undefined;
  }
})();
import nanoid from 'nanoid';
const db = require('better-sqlite3')('perms.db3', {});
const check_if_can_pin = db.prepare('SELECT * FROM pinners');
const check_for_reactionrole = db.prepare(
  'SELECT * FROM reactionroles WHERE emoji=? AND message=? AND server=?'
);
const check_for_reactionrole_msg = db.prepare(
  'SELECT * FROM reactionroles WHERE message=? AND server=?'
);
//const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const anonchannels = require('./anonchannels.js');
import * as util_functions from './util_functions';
const client = new Discord.Client({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});
interface MatcherCommand {
  command: string;
}
import { Command, Prefix } from './types';
import * as Types from './types';
import parse from 'parse-duration';
const main_commands = {
  title: 'Main Commands',
  description: 'All main bot commands',
  commands: [
    {
      name: 'pin',
      syntax: 'm: pin <MESSAGE>',
      explanation: 'Allows you to pin something anonymously',
      matcher: (cmd: MatcherCommand) => cmd.command === 'pin',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_MESSAGES'),
      simplematcher: (cmd: Array<string>) => cmd[0] === 'pin',
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'pin') return;
        msg.delete();
        try {
          await (await msg.channel.send(cmd.text)).pin();
          await Types.LogChannel.tryToLog(
            msg,
            `Pinned \n> ${cmd.text}\n to ${msg.channel}`
          );
        } catch (e) {
          throw new util_functions.BotError(
            'user',
            'Failed to pin: ' + e.toString().replace('DiscordAPIError: ', '')
          );
        }
      },
    },
    {
      name: 'eval',
      syntax: 'm: eval <CODE>',
      explanation: 'Run code',
      matcher: (cmd: MatcherCommand) => cmd.command == 'eval',
      permissions: (msg: Discord.Message) =>
        msg.author.id === '234020040830091265' &&
        msg.member &&
        msg.member.hasPermission('MANAGE_MESSAGES'),
      simplematcher: (cmd: Array<string>) => cmd[0] === 'eval',
      responder: async (msg: Discord.Message, cmd: Command) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        const discord = Discord;
        if (cmd.command !== 'eval') return;
        try {
          const cloneUser = async (user: string, text: string) => {
            if (msg.guild !== null && msg.channel.type == 'text') {
              const uuser = msg.guild.members.cache.get(user);
              if (!uuser) throw new Error('User not found');
              const loghook = await msg.channel.createWebhook(
                uuser.displayName,
                {
                  avatar: uuser.user.displayAvatarURL().replace('webp', 'png'),
                }
              );
              await loghook.send(text);
              await loghook.delete();
              await msg.delete();
            }
          };
          if (!cloneUser) return;
          eval(
            `(async () => {${cmd.code
              .replace('```js', '')
              .replace('```javascript', '')
              .replace(
                '```',
                ''
              )}})().catch(e=>msg.channel.send(\`Error: \${e}\`)).then(r=>r ? msg.channel.send(r) : 'Ran')`
          );
        } catch (e) {
          throw new util_functions.BotError('user', e);
        }
      },
    },
    {
      name: 'say',
      syntax: 'm: say [CHANNEL] <keep/remove> <TEXT>',
      explanation: 'Make the bot say something in a channel',
      matcher: (cmd: MatcherCommand) => cmd.command == 'say',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'say',
      permissions: (msg: Discord.Message) =>
        (msg.member && msg.member.hasPermission('MANAGE_MESSAGES')) ||
        msg.author.id === '234020040830091265',
      version: 3,
      responder: async (ctx: Types.Context, cmd: Command) => {
        if (cmd.command !== 'say') return;
        if ((cmd.channel || ctx.msg.channel).type !== 'text')
          throw new util_functions.BotError(
            'user',
            "Channel isn't a text channel!"
          );
        const chan = (cmd.channel || ctx.msg.channel) as Discord.TextChannel;
        if (!ctx.msg.guild)
          throw new util_functions.BotError('user', 'No guild found');
        if (!cmd.keep)
          util_functions.assertHasPerms(ctx.msg.guild, ['MANAGE_MESSAGES']);
        if (
          anonchannels.check_anon_channel.get(
            cmd.channel ? cmd.channel.id : ctx.msg.channel.id,
            ctx.msg.guild.id
          ) &&
          anonchannels.check_anon_ban.get({
            user: ctx.msg.author.id,
            server: ctx.msg.guild.id,
          })
        ) {
          throw new util_functions.BotError(
            'user',
            `${ctx.msg.author}, you're banned from sending messages there!`
          );
        }
        if (!chan.permissionsFor(ctx.msg.author)?.has('SEND_MESSAGES')) {
          throw new util_functions.BotError(
            'user',
            `${ctx.msg.author}, you can't send messages there!`
          );
        } else {
          if (!cmd.keep) await ctx.msg.delete();
          else await ctx.msg.react('✅');
          await ((cmd.channel || ctx.msg.channel) as Discord.TextChannel).send(
            cmd.text
          );
          await Types.LogChannel.tryToLog(
            ctx.msg,
            `Made ModBot say\n> ${cmd.text}\nin <#${
              cmd.channel ? cmd.channel.id : ctx.msg.channel.id
            }>`
          );
        }
      },
    },
    {
      name: 'setanonchannel',
      syntax: 'm: setanonchannel <enabled/disabled> [CHANNEL]',
      explanation:
        'Add/Remove an anonymous channel. If no channel is provided it will use the current channel',
      matcher: (cmd: MatcherCommand) => cmd.command == 'setanonchannel',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'setanonchannel',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'setanonchannel') return;
        if (!msg.guild || !msg.guild.id) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        const channel = cmd.channel ? cmd.channel : msg.channel.id;
        if (cmd.enabled) {
          db.prepare('INSERT INTO anonchannels VALUES (@channel, @server)').run(
            {
              channel: channel,
              server: (msg.guild as Discord.Guild).id,
            }
          );
        } else {
          db.prepare('DELETE FROM anonchannels WHERE id=? AND server=?').run(
            channel,
            (msg.guild as Discord.Guild).id
          );
        }
        msg.dbReply(
          util_functions.embed(
            `${cmd.enabled ? 'Enabled' : 'Disabled'} <#${channel}>${
              cmd.enabled
                ? '. Start a message with \\ to prevent it from being sent anonymously'
                : ''
            }`,
            'success'
          )
        );
        await Types.LogChannel.tryToLog(
          msg,
          `${cmd.enabled ? 'Enabled' : 'Disabled'} anonchannel <#${channel}>`
        );
      },
    },
    {
      name: 'listanonchannels',
      syntax: 'm: listanonchannels',
      explanation: 'Lists all anonymous channels',
      matcher: (cmd: MatcherCommand) => cmd.command == 'listanonchannels',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'listanonchannels',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg: util_functions.EMessage) => {
        if (!msg.guild || !msg.guild.id) return;
        const channels = db
          .prepare('SELECT * FROM anonchannels WHERE server=?')
          .all(msg.guild.id);
        if (channels.length == 0) {
          await msg.dbReply('No anon channels');
        } else {
          await msg.dbReply(
            channels
              .map(
                (channel: { id: string }) => `${channel.id} -> <#${channel.id}>`
              )
              .join('\n')
          );
        }
      },
    },
    {
      name: 'whosaid',
      syntax: 'm: whosaid <ID>',
      explanation: 'See who sent an anon message',
      matcher: (cmd: MatcherCommand) => cmd.command == 'whosaid',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'whosaid',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'whosaid') return;
        if (!msg.guild || !msg.guild.id) return;
        const author = db
          .prepare('SELECT * FROM anonmessages WHERE id=? AND server=?')
          .get(cmd.id, msg.guild.id);
        if (author) {
          await msg.dbReply(util_functions.desc_embed(`<@${author.user}>`));
        } else {
          await msg.dbReply('No message found');
        }
        await Types.LogChannel.tryToLog(
          msg,
          'Checked who said an anonymous message (id: `' + cmd.id + '`)'
        );
      },
    },
    {
      name: 'reminder',
      syntax:
        'm: reminder add <DURATION> <TEXT> / cancel <ID> / copy <ID> / list',
      explanation: 'Set/cancel/copy a reminder, or list all reminders',
      version: 2,
      matcher: (cmd: MatcherCommand) => cmd.command === 'reminder',
      simplematcher: (cmd: Array<string>) =>
        cmd[0] === 'reminder' || cmd[0] === 'reminders' || cmd[0] === 'rm',
      permissions: () => true,
      responder: async (
        ctx: Types.Context,
        cmd: Command
      ): Promise<Array<() => void> | undefined> => {
        if (cmd.command !== 'reminder' || !ctx.msg.guild) return;
        const undoStack: Array<() => void> = [];
        if (cmd.action === 'add') {
          const id = nanoid.nanoid(5);
          await Types.Reminder.query().insert({
            author: ctx.msg.author.id,
            id,
            text: await util_functions.cleanPings(cmd.text, ctx.msg.guild),
            time: moment().add(parse(cmd.time, 'ms'), 'ms').unix(),
          });
          util_functions.schedule_event(
            {
              type: 'reminder',
              text: await util_functions.cleanPings(cmd.text, ctx.msg.guild),
              channel: ctx.msg.channel.id,
              user: ctx.msg.author.id,
              message: ctx.msg.url,
              id,
            },
            cmd.time
          );
          undoStack.push(
            async () => await Types.Reminder.query().delete().where('id', id)
          );
          await ctx.msg.dbReply(
            util_functions.embed(
              `You can cancel it with \`${ctx.prefix}reminder cancel ${id}\`, or somebody else can run \`${ctx.prefix}reminder copy ${id}\` to also get reminded`,
              'success',
              'Set Reminder!'
            )
          );
        } else if (cmd.action === 'copy') {
          const orig = await Types.Reminder.query().where('id', cmd.id);
          if (!orig.length)
            throw new util_functions.BotError('user', 'Reminder not found');
          await Types.ReminderSubscriber.query().insert({
            user: ctx.msg.author.id,
            id: cmd.id,
          });
          await ctx.msg.dbReply(
            util_functions.embed(
              'You will be notifed when the reminder is ready!',
              'success'
            )
          );
        } else if (cmd.action === 'cancel') {
          await Types.Reminder.query()
            .delete()
            .where('author', ctx.msg.author.id)
            .where('id', cmd.id);
          await ctx.msg.dbReply(util_functions.embed('Cancelled!', 'success'));
        } else if (cmd.action === 'list') {
          const reminders = await Types.Reminder.query().where(
            'author',
            ctx.msg.author.id
          );
          let otherOp: number | null = 1;
          if (process.env.UI_URL) {
            otherOp = await util_functions.embed_options(
              'Would you like to view your reminders on discord or be given a link to a website that will allow you to manage them more easily?',
              ['Website', 'Discord'],
              ['🕸️', '✍️'],
              ctx.msg
            );
          }
          if (otherOp == 1) {
            const fields = util_functions.chunk(
              reminders
                .filter((n) => n.text)
                .flatMap((reminder) => {
                  return [
                    { name: 'Text', value: reminder.text, inline: true },
                    {
                      name: 'Time',
                      value: reminder.time
                        ? moment.unix(reminder.time).fromNow()
                        : '[CREATED BEFORE REMINDERS UPDATE]',
                      inline: true,
                    },
                    { name: 'ID', value: reminder.id, inline: true },
                  ];
                }),
              21
            );
            const replies = [
              new Discord.MessageEmbed().setTitle(
                `${ctx.msg.member?.displayName}'s Reminders`
              ),
            ];
            if (fields.length === 0)
              // Show Explanation for why reminders might be missing, but only for 1 month after update release
              replies[0].setDescription(
                'No reminders set.' +
                  (moment().isBefore(moment('11/8/2020', 'MM-DD-YY'))
                    ? ' (Only showing reminders created after October 8th, 2020)'
                    : '')
              );
            if (fields.length === 1) replies[0].addFields(fields[0]);
            else if (fields.length > 1) {
              replies[0].addFields(fields[0]);
              for (let i = 1; i < fields.length; i++) {
                replies.push(new Discord.MessageEmbed().addFields(fields[i]));
              }
            }
            await ctx.msg.dbReply(util_functions.desc_embed('DMing you!'));
            try {
              for (const reply of replies)
                await (await ctx.msg.author.createDM()).send(reply);
            } catch (e) {
              ctx.msg.dbReply(
                'Failed to send DM, do you have DMs enabled for this server?'
              );
            }
          } else if (otherOp === 0) {
            await ctx.msg.dbReply(util_functions.desc_embed('DMing you!'));
            try {
              await (await ctx.msg.author.createDM()).send(
                new Discord.MessageEmbed()
                  .setURL(
                    `${
                      process.env.UI_URL
                    }reminders/${await Web.mintCapabilityToken(
                      ctx.msg.author.id,
                      'reminders'
                    )}`
                  )
                  .setTitle('Click here to manage your reminders')
              );
            } catch (e) {
              ctx.msg.dbReply(
                'Failed to send DM, do you have DMs enabled for this server?'
              );
            }
          }
        }
        return undoStack;
      },
    },
    {
      name: 'clonepurge',
      syntax: 'm: clonepurge',
      explanation: 'Purge a channels entire history',
      matcher: (cmd: MatcherCommand) => cmd.command == 'clonepurge',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'clonepurge',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg: util_functions.EMessage) => {
        if (!msg.guild) return;
        util_functions.assertHasPerms(msg.guild, [
          'MANAGE_MESSAGES',
          'MANAGE_CHANNELS',
        ]);
        const type = await util_functions.embed_options(
          'What should I do to the original channel?',
          ['Delete', 'Archive', 'Nothing'],
          ['🗑️', '📂', '💾'],
          msg
        );
        const clone = async (type: 0 | 1 | 2 | null) => {
          if (!msg.guild || !msg.guild.id) return;
          if (msg.channel.type !== 'text')
            throw new util_functions.BotError('user', 'Not a text channel!');
          await msg.dbReply(util_functions.desc_embed('Running clonepurge'));
          const new_channel = await msg.channel.clone();
          await new_channel.setPosition(msg.channel.position);
          await new_channel.setTopic(msg.channel.topic || '');
          await new_channel.send(util_functions.desc_embed('CLONING PINS'));
          const pins = (await msg.channel.messages.fetchPinned()).array();
          pins.reverse();
          const anonhook = await new_channel.createWebhook('ClonePurgeHook');
          try {
            for (const pin of pins) {
              //console.log(pin);
              const msg_username = pin.member
                ? pin.member.displayName
                : pin.author.username;
              await (
                await anonhook.send(pin.content, {
                  embeds: pin.embeds,
                  files: pin.attachments.array().map((n) => n.url),
                  username: msg_username,
                  avatarURL: pin.author.displayAvatarURL(),
                })
              ).pin();
            }
            await anonhook.delete();
            if (type === 2) {
              await msg.dbReply(util_functions.desc_embed('Finished.'));
            } else if (type === 1) {
              await msg.dbReply(util_functions.desc_embed('Archiving'));
              let deleted_catergory = msg.guild.channels.cache.find(
                (n) => n.type == 'category' && n.name == 'archived'
              );
              if (!deleted_catergory) {
                deleted_catergory = await msg.guild.channels.create(
                  'archived',
                  {
                    type: 'category',
                  }
                );
              }
              await msg.channel.setParent(
                deleted_catergory as Discord.CategoryChannel
              );
              await msg.channel.overwritePermissions([
                {
                  id: msg.guild.id,
                  deny: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
                },
                {
                  id: msg.author.id,
                  allow: ['VIEW_CHANNEL'],
                },
              ]);
              await msg.dbReply(util_functions.desc_embed('Finished.'));
            } else {
              await msg.dbReply(
                util_functions.embed(
                  'Finished. Deleting channel in 10 seconds',
                  'warning'
                )
              );
              await sleep(10000);
              await msg.channel.delete();
            }
          } catch (e) {
            await msg.dbReply(
              util_functions.desc_embed(`Clonepurge failed: ${e}`)
            );
            await new_channel.delete();
          }
        };
        if (type === 0) {
          if (await util_functions.confirm(msg)) {
            await clone(type);
            await Types.LogChannel.tryToLog(
              msg,
              `Clonepurged #${(msg.channel as Discord.TextChannel).name}`
            );
          }
        } else if (type !== null) {
          await clone(type as 0 | 1 | 2 | null);
          await Types.LogChannel.tryToLog(
            msg,
            `Clonepurged ${msg.channel as Discord.TextChannel}`
          );
        }
      },
    },
    {
      name: 'deletechannel',
      syntax: 'm: deletechannel',
      explanation: 'Delete channel',
      matcher: (cmd: MatcherCommand) => cmd.command == 'deletechannel',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'deletechannel',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_CHANNELS'),
      version: 2,
      responder: async (
        ctx: Types.Context
      ): Promise<Array<() => void> | undefined> => {
        if (!ctx.msg.guild) return;
        util_functions.assertHasPerms(ctx.msg.guild, ['MANAGE_CHANNELS']);
        if (ctx.msg.channel.id == '707361413894504489') return;
        if (await util_functions.confirm(ctx.msg)) {
          ctx.msg.dbReply(
            util_functions.embed('Deleting channel in 5 seconds', 'warning')
          );
          const tmpTimeout = setTimeout(async () => {
            await ctx.msg.channel.delete();
          }, 5000);
          await Types.LogChannel.tryToLog(
            ctx.msg,
            `Deleted #${(ctx.msg.channel as Discord.TextChannel).name}`
          );
          return [() => clearTimeout(tmpTimeout)];
        }
      },
    },
    {
      name: 'channeluser',
      syntax: 'm: channeluser <add/remove> <USER> [CHANNEL]',
      explanation: 'Add/Remove a user from a channel',
      matcher: (cmd: MatcherCommand) => cmd.command == 'channeluser',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'channeluser',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'channeluser') return;
        if (!client.user || !msg.member || !msg.guild)
          throw new util_functions.BotError(
            'user',
            'Something is seriously broken'
          );
        util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
        const channel = client.channels.cache.get(
          cmd.channel ? cmd.channel : msg.channel.id
        );
        if (!channel)
          throw new util_functions.BotError('user', 'Channel not found');
        if (channel.type != 'text')
          throw new util_functions.BotError('user', 'Not a text channel');
        const realchannel: Discord.TextChannel = channel as Discord.TextChannel;
        if (!realchannel.permissionsFor(msg.member))
          throw new util_functions.BotError(
            'user',
            'Something is seriously broken'
          );
        if (
          !(realchannel.permissionsFor(msg.member) as Discord.Permissions).has(
            'VIEW_CHANNEL'
          )
        ) {
          await msg.dbReply("Sorry, you can't access that channel");
          return;
        }
        const user = msg.guild.member(cmd.user);
        if (!user) throw new util_functions.BotError('user', 'User not found');
        if (!cmd.allowed) {
          await realchannel.updateOverwrite(user, { VIEW_CHANNEL: false });
        } else {
          await realchannel.updateOverwrite(user, { VIEW_CHANNEL: true });
        }
        await msg.dbReply(
          util_functions.embed(
            `${cmd.allowed ? 'Allowed' : 'Disallowed'} ${user} ${
              cmd.allowed ? 'to' : 'from'
            } ${cmd.allowed ? 'read' : 'reading'} messages in ${channel}`,
            'success'
          )
        );
        await Types.LogChannel.tryToLog(
          msg,
          `${cmd.allowed ? 'Allowed' : 'Disallowed'} ${user} ${
            cmd.allowed ? 'to' : 'from'
          } ${cmd.allowed ? 'read' : 'reading'} messages in ${channel}`
        );
      },
    },
    {
      name: 'archivechannel',
      syntax: 'm: archivechannel <ROLE>',
      explanation:
        'Archive a channel. Users with specified role will still be able to see it',
      matcher: (cmd: MatcherCommand) => cmd.command == 'archivechannel',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'archivechannel',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'archivechannel' || !msg.guild) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
        const deleted_category = (msg.guild.channels.cache.find(
          (n) => n.type == 'category' && n.name == 'archived'
        ) ||
          (await msg.guild.channels.create('archived', {
            type: 'category',
          }))) as Discord.CategoryChannel;

        if (msg.channel.type !== 'text')
          throw new util_functions.BotError('user', 'Not a text channel');
        await msg.channel.setParent(deleted_category);
        await msg.channel.overwritePermissions([
          {
            id: msg.guild.id,
            deny: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
          },
          {
            id: cmd.role,
            allow: ['VIEW_CHANNEL'],
          },
        ]);
        await msg.dbReply(util_functions.embed('Archived channel!', 'success'));
        await Types.LogChannel.tryToLog(msg, `Archived ${msg.channel}`);
      },
    },
    {
      name: 'anonban',
      syntax: 'm: anonban <USER> [TIME]',
      explanation: 'Ban a user from going anonymous',
      matcher: (cmd: MatcherCommand) => cmd.command == 'anonban',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'anonban',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'anonban' || !msg.guild) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        anonchannels.insert_anon_ban.run({
          user: cmd.user,
          server: msg.guild.id,
        });
        if (cmd.time) {
          util_functions.schedule_event(
            {
              type: 'anonunban',
              channel: msg.channel.id,
              user: cmd.user,
              server: msg.guild.id,
            },
            cmd.time
          );
          await msg.dbReply(
            util_functions.embed(
              `Banned <@${cmd.user}> for ${cmd.time}`,
              'success'
            )
          );
          await Types.LogChannel.tryToLog(
            msg,
            `Banned <@${cmd.user}> from anonchannels for ${cmd.time}`
          );
        } else {
          await msg.dbReply(
            util_functions.embed(`Banned <@${cmd.user}>`, 'success')
          );
          await Types.LogChannel.tryToLog(
            msg,
            `Banned <@${cmd.user}> from anonchannels`
          );
        }
      },
    },
    {
      name: 'anonunban',
      syntax: 'm: anonunban <USER>',
      explanation: 'Unban a user from going anonymous',
      matcher: (cmd: MatcherCommand) => cmd.command == 'anonunban',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'anonunban',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'anonunban' || !msg.guild) return;
        anonchannels.remove_anon_ban.run({
          user: cmd.user,
          server: msg.guild.id,
        });
        await msg.dbReply(
          util_functions.embed(`Unbanned <@${cmd.user}>`, 'success')
        );
        await Types.LogChannel.tryToLog(
          msg,
          `Unbanned <@${cmd.user}> from anonchannels`
        );
      },
    },
    {
      name: 'tmpchannel',
      syntax: 'm: tmpchannel <NAME> <DURATION> <private/public>',
      explanation: 'Create a temporary channel',
      matcher: (cmd: MatcherCommand) => cmd.command == 'tmpchannel',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'tmpchannel',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'tmpchannel' || !msg.guild) return;
        if (!client.user)
          throw new util_functions.BotError(
            'user',
            'Something is seriously broken'
          );
        util_functions.assertHasPerms(msg.guild, [
          'MANAGE_CHANNELS',
          'MANAGE_MESSAGES',
        ]);
        let channel;
        try {
          channel = await msg.guild.channels.create(cmd.name, {
            type: 'text',
            permissionOverwrites: cmd.public
              ? [
                  {
                    id: client.user.id,
                    allow: ['VIEW_CHANNEL'],
                  },
                ]
              : [
                  {
                    id: msg.guild.id,
                    deny: ['VIEW_CHANNEL'],
                  },
                  {
                    id: msg.author.id,
                    allow: ['VIEW_CHANNEL'],
                  },
                  {
                    id: client.user.id,
                    allow: ['VIEW_CHANNEL'],
                  },
                ],
          });
        } catch (e) {
          throw new util_functions.BotError(
            'user',
            'Failed to create channel: ' + e
          );
        }
        util_functions.schedule_event(
          { type: 'deletechannel', channel: channel.id },
          cmd.duration
        );
        const deletion_time = moment().add(parse_duration(cmd.duration));
        let tm_text = `Deleting channel ${deletion_time.fromNow()}`;
        const time_message = await channel.send(
          util_functions.desc_embed(tm_text)
        );
        await time_message.pin();
        const deferred = await Defer.add({
          type: 'UpdateTmpDeletionMessage',
          channel: time_message.channel.id,
          message: time_message.id,
          deletionTime: cmd.duration,
        });
        setTimeout(() => deferred.cancel(), parse(cmd.duration, 'ms') || 0);
        const ei = setInterval(async () => {
          if (tm_text != `Deleting channel ${deletion_time.fromNow()}`) {
            tm_text = `Deleting channel ${deletion_time.fromNow()}`;
            try {
              if (tm_text != 'Deleting channel a few seconds ago')
                await time_message.edit(util_functions.desc_embed(tm_text));
            } catch (e) {
              clearInterval(ei);
            }
          }
        }, 5000);
        await msg.dbReply(
          util_functions.embed(
            `Creating ${channel} for ${cmd.duration}`,
            'success'
          )
        );
        await Types.LogChannel.tryToLog(
          msg,
          `Created tmpchannel #${(channel as Discord.TextChannel).name} for ${
            cmd.duration
          }`
        );
      },
    },
    {
      name: 'setpinperms',
      syntax: 'm: setpinperms <allowed/disallowed> <ROLE>',
      explanation: 'Choose if a role can pin messages with the :pushpin: react',
      matcher: (cmd: MatcherCommand) => cmd.command == 'setpinperms',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'setpinperms',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_ROLES'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'setpinperms' || !msg.guild) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        if (cmd.allowed) {
          db.prepare('INSERT INTO pinners VALUES (?, ?)').run(
            cmd.role,
            msg.guild.id
          );
          msg.dbReply(
            util_functions.embed(
              `<@&${cmd.role}> are now allowed to pin messages with :pushpin:`,
              'success'
            )
          );
          await Types.LogChannel.tryToLog(
            msg,
            `Allowed <@&${cmd.role}> to pin messages with :pushpin:`
          );
        } else {
          db.prepare('DELETE FROM pinners WHERE roleid=? AND guild=?').run(
            cmd.role,
            msg.guild.id
          );
          msg.dbReply(
            util_functions.embed(
              `<@&${cmd.role}> are no longer allowed to pin messages with :pushpin:`,
              'success'
            )
          );
          await Types.LogChannel.tryToLog(
            msg,
            `Disallowed <@&${cmd.role}> from pinning messages with :pushpin:`
          );
        }
      },
    },
    {
      name: 'listpinperms',
      syntax: 'm: listpinperms',
      explanation: 'List all roles with :pushpin: permissions',
      matcher: (cmd: MatcherCommand) => cmd.command == 'listpinperms',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'listpinperms',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_ROLES'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'listpinperms' || !msg.guild) return;
        const roles = db
          .prepare('SELECT * FROM pinners WHERE guild=?')
          .all(msg.guild.id);
        msg.dbReply(
          util_functions.desc_embed(
            roles
              .map((n: { roleid: string }) => `${n.roleid} (<@&${n.roleid}>)`)
              .join('\n') || 'None'
          )
        );
      },
    },
    {
      name: 'autoresponder',
      syntax: 'm: autoresponder <add/remove/list>',
      explanation: 'Configure the AutoResponder',
      matcher: (cmd: MatcherCommand) => cmd.command == 'autoresponder',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'autoresponder',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'autoresponder' || !msg.guild) return;
        if (cmd.action === 'add') {
          try {
            await msg.dbReply(
              new Discord.MessageEmbed()
                .setTitle('Tip!')
                .setColor('#397cd1')
                .setDescription(
                  'You can define custom variables like `{{NAME}}` that can be used in the AutoResponder reply'
                )
            );
            const prompt = await msg.ask(
              'What message should this AutoResponder reply to?',
              50000
            );
            const parsedPrompt = AutoResponders.parsePrompt(prompt);
            const [matched, variables] = AutoResponders.parseText(
              prompt,
              parsedPrompt
            );
            if (!matched)
              throw new util_functions.BotError(
                'user',
                "There's something badly wrong with your variables, I can't seem to parse them"
              );
            if ([...variables.values()].some((n) => n === null))
              msg.dbReply(
                util_functions.embed(
                  'Your variables are **ambiguous**, you might get unexpected results',
                  'warning'
                )
              );
            const message_type = await util_functions.embed_options(
              'Message type?',
              ['Text', 'Embed'],
              ['📝', '🔗'],
              msg
            );
            await msg.dbReply(
              new Discord.MessageEmbed()
                .setTitle('Tip!')
                .setColor('#397cd1')
                .setDescription(
                  '`{{author}}` will be replaced with a mention of the user who triggered the AutoResponder'
                )
            );
            if (message_type === 0) {
              const response = await msg.ask(
                'What should I reply with?',
                50000
              );
              db.prepare(
                'REPLACE INTO autoresponders(prompt, type, text_response, server) VALUES (?, ?, ?, ?)'
              ).run(prompt, 'text', response, msg.guild.id);
            } else if (message_type === 1) {
              const embed_title = await util_functions.askOrNone(
                'What should the embed title be?',
                40000,
                msg
              );
              const embed_desc = await msg.ask(
                'What should the embed description be?',
                50000
              );
              db.prepare(
                'REPLACE INTO autoresponders(prompt, type, embed_title, embed_description, server) VALUES (?, ?, ?, ?, ?)'
              ).run(prompt, 'embed', embed_title, embed_desc, msg.guild.id);
            } else {
              return;
            }
            await msg.dbReply(
              util_functions.embed('Added AutoResponder', 'success')
            );
            await Types.LogChannel.tryToLog(
              msg,
              `Added AutoResponder to \`${prompt}\``
            );
          } catch (e) {
            if (e instanceof util_functions.BotError) throw e;
            console.log(e);
            await msg.dbReply(
              util_functions.desc_embed('Failed to create AutoResponder')
            );
          }
        } else if (cmd.action === 'remove') {
          const prompt = await msg.ask(
            'What AutoResponder would you like to remove?',
            50000
          );
          const rc = db
            .prepare(
              'DELETE FROM autoresponders WHERE lower(prompt)=lower(?) AND server=?'
            )
            .run(prompt, msg.guild.id);
          if (rc.changes) {
            await msg.dbReply(
              util_functions.desc_embed('Removed AutoResponder')
            );
            await Types.LogChannel.tryToLog(
              msg,
              `Removed AutoResponder for \`${prompt}\``
            );
          } else
            await msg.dbReply(
              util_functions.desc_embed("Couldn't find AutoResponder")
            );
        } else if (cmd.action === 'list') {
          const ars = db
            .prepare('SELECT * FROM autoresponders WHERE server=?')
            .all(msg.guild.id);
          await msg.dbReply(
            util_functions.desc_embed(
              ars
                ? ars.map((n: { prompt: string }) => `${n.prompt}`).join('\n')
                : 'None'
            )
          );
        }
      },
    },
    {
      name: 'alpha',
      syntax: 'm: alpha <TEXT>',
      explanation: 'Query Wolfram Alpha',
      matcher: (cmd: MatcherCommand) => cmd.command == 'alpha',
      version: 2,
      simplematcher: (cmd: Array<string>) =>
        cmd[0] === 'alpha' || cmd[0] === 'a',
      permissions: () => process.env.WOLFRAMALPHA_KEY,
      responder: async (ctx: Types.Context, cmd: Command) => {
        if (cmd.command !== 'alpha') return;
        if (
          ctx.store.get(`alpha.${cmd.text}`) &&
          !['random', 'dice', 'die', 'roll', 'pick'].some((s) =>
            cmd.text.includes(s)
          )
        ) {
          sendAlphaResult(ctx, cmd);
          return;
        }
        ctx.store.addOrCreate(
          `rateLimits.alpha.${ctx.msg.author.id}`,
          1,
          30000
        );
        if (
          (ctx.store.get(`rateLimits.alpha.${ctx.msg.author.id}`) as number) > 3
        )
          throw new util_functions.BotError(
            'user',
            `Sorry, please wait **${+toFixed(
              (ctx.store.timeLeft(`rateLimits.alpha.${ctx.msg.author.id}`) ||
                0) / 1000
            )}s** before trying again`
          );
        ctx.msg.channel.startTyping();
        try {
          const res = await (
            await nodefetch(
              'http://api.wolframalpha.com/v2/query?appid=' +
                process.env.WOLFRAMALPHA_KEY +
                '&input=' +
                encodeURIComponent(cmd.text) +
                '&format=plaintext&output=json'
            )
          ).json();
          ctx.store.set(
            `alpha.${cmd.text}`,
            res.queryresult.pods[1].subpods[0].plaintext
          );
          sendAlphaResult(ctx, cmd);
          ctx.msg.channel.stopTyping();
        } catch (e) {
          ctx.msg.dbReply(
            new Discord.MessageEmbed()
              .setAuthor(
                'Wolfram Alpha',
                'https://media.discordapp.net/attachments/745460367173484624/765623618297790464/wolfram-alpha-2-569293.png',
                'https://www.wolframalpha.com/'
              )
              .setTitle('No Result')
              .setDescription("Wolfram Alpha didn't have an answer for that")
              .setColor('#cc4d42')
          );
          ctx.msg.channel.stopTyping();
        }
      },
    },
    {
      name: 'support',
      syntax: 'm: support',
      explanation: 'Get an invite to the support server',
      matcher: (cmd: MatcherCommand) => cmd.command == 'support',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'support',
      permissions: () => true,
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'support') return;
        msg.dbReply(
          new Discord.MessageEmbed()
            .setURL('https://discord.gg/wJ2TCpx')
            .setTitle('Click here to join the support server')
        );
      },
    },
    {
      name: 'joinroles',
      syntax: 'm: joinroles <enable/disable>',
      explanation: 'Configure roles given automatically to users who join',
      matcher: (cmd: MatcherCommand) => cmd.command == 'joinroles',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'joinroles',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_ROLES'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'joinroles' || !msg.guild || !msg.member) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
        if (cmd.action === 'enable') {
          if (
            db
              .prepare('SELECT * FROM join_roles WHERE server=?')
              .get(msg.guild.id)
          ) {
            throw new util_functions.BotError(
              'user',
              'This server already has a join role. You can disable it with `m: joinroles disable`'
            );
          }
          await msg.dbReply(
            'What role would you like to set as the join role?'
          );
          const role = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 20000,
            }
          );
          if (!role.array().length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          const rrole = role
            .array()[0]
            .content.replace('<@&', '')
            .replace('>', '');
          const disc_role = msg.guild.roles.cache.get(rrole);
          if (!disc_role) {
            await msg.dbReply("Role doesn't exist!");
            return;
          }
          if (disc_role.position >= msg.member.roles.highest.position)
            throw new util_functions.BotError(
              'user',
              'That role is above or equal to your current highest role'
            );
          db.prepare('INSERT INTO join_roles VALUES (?, ?)').run(
            msg.guild.id,
            rrole
          );
          await msg.dbReply(util_functions.desc_embed('Setup!'));
          await Types.LogChannel.tryToLog(msg, 'Added JoinRole');
        } else if (cmd.action === 'disable') {
          if (
            !db
              .prepare('SELECT * FROM join_roles WHERE server=?')
              .get(msg.guild.id)
          ) {
            throw new util_functions.BotError(
              'user',
              "This server doesn't have a join role."
            );
          }
          db.prepare('DELETE FROM join_roles WHERE server=?').run(msg.guild.id);
          await msg.dbReply(util_functions.desc_embed('Disabled!'));
          await Types.LogChannel.tryToLog(msg, 'Removed JoinRole');
        }
      },
    },
    {
      name: 'reactionroles',
      syntax: 'm: reactionroles <add/edit>',
      explanation: 'Configure reaction roles',
      matcher: (cmd: MatcherCommand) => cmd.command == 'reactionroles',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'reactionroles',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_ROLES'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'reactionroles' || !msg.guild || !msg.member)
          return;
        util_functions.assertHasPerms(msg.guild, [
          'MANAGE_ROLES',
          'MANAGE_MESSAGES',
        ]);
        if (cmd.action === 'add') {
          await msg.dbReply(
            'What channel would you like the message to be in?'
          );

          const chan = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 40000,
            }
          );
          if (!chan.array().length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          const cchan = chan
            .array()[0]
            .content.replace('<#', '')
            .replace('>', '');
          const removable = await util_functions.embed_options(
            'Should the role be removable by un-reacting?',
            ['Yes', 'No'],
            ['✅', '❌'],
            msg,
            40000
          );
          const embed_title = await util_functions.askOrNone(
            'What should the embed title be?',
            80000,
            msg
          );
          await msg.dbReply('What should the embed description be?');
          const embed_description = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 90000,
            }
          );
          if (!embed_description.array().length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          await msg.dbReply(
            'What should the reactions be?\nFormat:\n```:grinning: @happy\n:sad: @unhappy```'
          );
          const reacts = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 90000,
            }
          );
          if (!reacts.array().length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          let rr_mes;
          try {
            const tmp_chan = msg.guild.channels.cache.get(cchan);
            if (!tmp_chan || tmp_chan.type !== 'text') {
              await msg.dbReply(
                util_functions.desc_embed("Channel doesn't exist!")
              );
              return;
            }
            rr_mes = await (tmp_chan as Discord.TextChannel).send(
              new Discord.MessageEmbed()
                .setTitle(embed_title)
                .setDescription(embed_description.array()[0].content)
            );
          } catch (e) {
            await msg.dbReply(
              util_functions.desc_embed("Couldn't send message!")
            );
            return;
          }
          const hp = msg.member.roles.highest.position;
          console.log(hp);
          const reacts_formatted = reacts
            .array()[0]
            .content.split('\n')
            .map((n) => {
              return {
                emoji: n.split(' ').filter((n) => n)[0],
                role: n
                  .split(' ')
                  .filter((n) => n)[1]
                  .replace('<@&', '')
                  .replace('>', ''),
              };
            });
          for (const react of reacts_formatted) {
            // Check role levels
            const serv_role = msg.guild.roles.cache.get(react.role);
            if (!serv_role)
              throw new util_functions.BotError(
                'user',
                `${react.role} does not exist`
              );
            if (serv_role.position >= hp) {
              await msg.dbReply(
                util_functions.desc_embed(
                  'Your highest role position is below one of the roles you tried to add'
                )
              );
              return;
            }
          }
          for (const react of reacts_formatted) {
            if (!react.emoji.includes('<')) {
              await rr_mes.react(react.emoji);
              db.prepare(
                'INSERT INTO reactionroles VALUES (?, ?, ?, ?, ?)'
              ).run(
                rr_mes.id,
                msg.guild.id,
                react.emoji,
                react.role,
                removable !== 1 ? 1 : 0
              );
            } else {
              const em = msg.guild.emojis.cache.find(
                (n) => `<:${n.name}:${n.id}>` == react.emoji
              );
              if (!em) {
                await msg.dbReply(
                  util_functions.desc_embed(
                    'Emoji not found. You can only use emojis from this server'
                  )
                );
                await rr_mes.delete();
                return;
              }
              db.prepare(
                'INSERT INTO reactionroles VALUES (?, ?, ?, ?, ?)'
              ).run(
                rr_mes.id,
                msg.guild.id,
                em.id,
                react.role,
                removable !== 1 ? 1 : 0
              );
              await rr_mes.react(em.id);
            }
          }
          await msg.dbReply(util_functions.desc_embed('Added!'));
          await Types.LogChannel.tryToLog(
            msg,
            `Added ReactionRole in ${rr_mes.channel}`
          );
        } else if (cmd.action === 'edit') {
          await msg.dbReply('What channel is the message in?');
          const chan = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 20000,
            }
          );
          if (!chan.array().length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          const cchan = chan
            .array()[0]
            .content.replace('<#', '')
            .replace('>', '');
          if (!cchan)
            throw new util_functions.BotError('user', 'No channel found');
          const real_chan = msg.guild.channels.cache.get(cchan);
          if (!real_chan || real_chan.type !== 'text')
            throw new util_functions.BotError('user', 'No channel found');
          await msg.dbReply('What is the message ID?');
          const mid = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 20000,
            }
          );
          if (!mid.array().length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          let rr_mes;
          try {
            rr_mes = await (real_chan as Discord.TextChannel).messages.fetch(
              mid.array()[0].content
            );
          } catch (e) {
            await msg.dbReply(
              util_functions.desc_embed("Couldn't find message")
            );
            return;
          }
          const removable = await util_functions.embed_options(
            'Should the role be removable by un-reacting?',
            ['Yes', 'No'],
            ['✅', '❌'],
            msg,
            20000
          );
          const embed_title = await util_functions.askOrNone(
            'What should the embed title be?',
            80000,
            msg
          );
          await msg.dbReply('What should the embed description be?');
          const embed_description = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 70000,
            }
          );
          if (!embed_description.array().length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          await rr_mes.edit(
            new Discord.MessageEmbed()
              .setTitle(embed_title)
              .setDescription(embed_description.array()[0].content)
          );
          await msg.dbReply(
            'What should the reactions be?\nFormat:\n```:grinning: @happy\n:sad: @unhappy```'
          );
          const reacts = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 70000,
            }
          );
          if (!reacts.array().length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          const hp = msg.member.roles.highest.position;
          console.log(hp);
          const reacts_formatted = reacts
            .array()[0]
            .content.split('\n')
            .map((n) => {
              return {
                emoji: n.split(' ').filter((n) => n)[0],
                role: n
                  .split(' ')
                  .filter((n) => n)[1]
                  .replace('<@&', '')
                  .replace('>', ''),
              };
            });
          for (const react of reacts_formatted) {
            // Check role levels
            const serv_role = msg.guild.roles.cache.get(react.role);
            if (!serv_role)
              throw new util_functions.BotError(
                'user',
                `${react.role} does not exist`
              );
            if (serv_role.position >= hp) {
              await msg.dbReply(
                util_functions.desc_embed(
                  'Your highest role position is below one of the roles you tried to add'
                )
              );
              return;
            }
          }
          db.prepare('DELETE FROM reactionroles WHERE message=?').run(
            rr_mes.id
          );
          for (const react of reacts_formatted) {
            if (!react.emoji.includes('<')) {
              await rr_mes.react(react.emoji);
              db.prepare(
                'INSERT INTO reactionroles VALUES (?, ?, ?, ?, ?)'
              ).run(
                rr_mes.id,
                msg.guild.id,
                react.emoji,
                react.role,
                removable !== 1 ? 1 : 0
              );
            } else {
              const em = msg.guild.emojis.cache.find(
                (n) => `<:${n.name}:${n.id}>` == react.emoji
              );
              if (!em) {
                await msg.dbReply(
                  util_functions.desc_embed(
                    'Emoji not found. You can only use emojis from this server'
                  )
                );
                return;
              }
              db.prepare(
                'INSERT INTO reactionroles VALUES (?, ?, ?, ?, ?)'
              ).run(
                rr_mes.id,
                msg.guild.id,
                em.id,
                react.role,
                removable !== 1 ? 1 : 0
              );
              await rr_mes.react(em.id);
            }
          }
          for (const reaction of rr_mes.reactions.cache.array()) {
            if (!reaction.message.guild)
              throw new util_functions.BotError(
                'user',
                'Error removing reactions from message'
              );
            let rr = check_for_reactionrole.get(
              reaction.emoji.name,
              reaction.message.id,
              reaction.message.guild.id
            );
            if (!rr)
              rr = check_for_reactionrole.get(
                reaction.emoji.id,
                reaction.message.id,
                reaction.message.guild.id
              );
            if (!rr) {
              reaction.remove();
            }
          }
          await msg.dbReply(util_functions.desc_embed('Edited!'));
          await Types.LogChannel.tryToLog(
            msg,
            `Edited ReactionRole in ${rr_mes.channel}`
          );
        }
      },
    },
    {
      name: 'kick',
      syntax: 'm: kick <USER>',
      explanation: 'Kick a user',
      matcher: (cmd: MatcherCommand) => cmd.command == 'kick',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'kick',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('KICK_MEMBERS'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'kick' || !msg.member || !msg.guild) return;
        util_functions.assertHasPerms(msg.guild, ['KICK_MEMBERS']);
        const hp = msg.member.roles.highest.position;
        const kickee = msg.guild.members.cache.get(cmd.user);
        if (!kickee)
          throw new util_functions.BotError(
            'user',
            'User not found\nHelp: Have they left the server?'
          );
        const kickee_hp = kickee.roles.highest.position;
        if (kickee_hp >= hp) {
          throw new util_functions.BotError(
            'user',
            'Your highest role is below or equal to the user you are trying to kick'
          );
        } else {
          const conf = await util_functions.confirm(msg);
          if (conf) {
            if (kickee.id !== client.user?.id) {
              await kickee.kick();
              await Types.LogChannel.tryToLog(msg, `Kicked ${kickee}`);
              await msg.dbReply(util_functions.desc_embed('Kicked'));
            } else {
              await Types.LogChannel.tryToLog(msg, `Kicked ${kickee}`);
              await msg.dbReply(util_functions.desc_embed('Kicked'));
              await msg.guild.leave();
            }
          }
        }
      },
    },
    {
      name: 'ban',
      syntax: 'm: ban <USER>',
      explanation: 'Ban a user',
      matcher: (cmd: MatcherCommand) => cmd.command == 'ban',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'ban',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('BAN_MEMBERS'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'ban' || !msg.member || !msg.guild) return;
        util_functions.assertHasPerms(msg.guild, ['BAN_MEMBERS']);
        const hp = msg.member.roles.highest.position;
        const kickee = msg.guild.members.cache.get(cmd.user);
        if (!kickee)
          throw new util_functions.BotError(
            'user',
            'User not found\nHelp: Have they left the server?'
          );
        const kickee_hp = kickee.roles.highest.position;
        if (kickee_hp >= hp) {
          throw new util_functions.BotError(
            'user',
            'Your highest role is below or equal to the user you are trying to ban'
          );
        } else {
          const conf = await util_functions.confirm(msg);
          if (conf) {
            if (kickee.id !== client.user?.id) {
              await kickee.ban({ reason: `Banned by @${msg.author.tag}` });
              await Types.LogChannel.tryToLog(msg, `Banned ${kickee}`);
              await msg.dbReply(util_functions.desc_embed('Banned'));
            } else {
              await Types.LogChannel.tryToLog(msg, `Banned ${kickee}`);
              await msg.dbReply(util_functions.desc_embed('Banned'));
              await msg.guild.leave();
            }
          }
        }
      },
    },
    {
      name: 'tmprole',
      syntax: 'm: tmprole <add/remove> <USER> <ROLE> <DURATION>',
      explanation: "Temporarily change a user's role",
      matcher: (cmd: MatcherCommand) => cmd.command == 'tmprole',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'tmprole',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_ROLES'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'tmprole' || !msg.member || !msg.guild) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
        const hp = msg.member.roles.highest.position;
        const kickee = msg.guild.members.cache.get(cmd.user);
        if (!kickee)
          throw new util_functions.BotError(
            'user',
            'User not found\nHelp: Have they left the server?'
          );
        const kickee_hp = kickee.roles.highest.position;
        if (kickee_hp >= hp && kickee.id != msg.author.id) {
          throw new util_functions.BotError(
            'user',
            'Your highest role is below or equal to the user you are trying to change roles on'
          );
        } else {
          if (cmd.action === 'remove') {
            if (!kickee.roles.cache.get(cmd.role)) {
              throw new util_functions.BotError(
                'user',
                `${kickee} doesn't have <@&${cmd.role}>`
              );
            }
            await kickee.roles.remove(cmd.role);
            util_functions.schedule_event(
              {
                type: 'tmprole',
                user: kickee.id,
                channel: msg.channel.id,
                role: cmd.role,
                action: 'add',
              },
              cmd.duration
            );
            await msg.dbReply(
              util_functions.embed(
                `Removed <@&${cmd.role}> from ${kickee} for ${cmd.duration}`,
                'success'
              )
            );
          } else if (cmd.action === 'add') {
            const role_to_be_added = msg.guild.roles.cache.get(cmd.role);
            if (!role_to_be_added) {
              await msg.dbReply(
                util_functions.desc_embed(`<@&${cmd.role}> doesn't exist`)
              );
              return;
            }
            if (hp <= role_to_be_added.position) {
              throw new util_functions.BotError(
                'user',
                `<@&${cmd.role}> is equal to or above you in the role list`
              );
            }
            await kickee.roles.add(cmd.role);
            util_functions.schedule_event(
              {
                type: 'tmprole',
                user: kickee.id,
                channel: msg.channel.id,
                role: cmd.role,
                action: 'remove',
              },
              cmd.duration
            );
            await msg.dbReply(
              util_functions.embed(
                `Added <@&${cmd.role}> to ${kickee} for ${cmd.duration}`,
                'success'
              )
            );
            await Types.LogChannel.tryToLog(
              msg,
              `Added <@&${cmd.role}> to ${kickee} for ${cmd.duration}`
            );
          }
        }
      },
    },
    {
      name: 'purge',
      syntax: 'm: purge <COUNT>',
      explanation: 'Purge messages',
      matcher: (cmd: MatcherCommand) => cmd.command == 'purge',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'purge',
      permissions: (msg: Discord.Message) =>
        msg.member &&
        msg.channel.type == 'text' &&
        msg.channel.permissionsFor(msg.member)?.has('MANAGE_MESSAGES'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'purge' || !msg.guild) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        const count = parseInt(cmd.count);
        if (count > 50) {
          throw new util_functions.BotError(
            'user',
            'Must be less than or equal to 50 messages'
          );
        }
        try {
          const purged_msg_num = await (msg.channel as Discord.TextChannel).bulkDelete(
            count + 1
          );
          const purged_info_msg = await msg.channel.send(
            `Purged ${purged_msg_num.array().length - 1} messages`
          );
          setTimeout(() => {
            purged_info_msg.delete();
          }, 2000);
          await Types.LogChannel.tryToLog(
            msg,
            `Purged ${count} message${count === 1 ? '' : 's'} in ${msg.channel}`
          );
        } catch (e) {
          throw new util_functions.BotError('user', e);
        }
      },
    },
    {
      name: 'usercard',
      syntax: 'm: usercard <USER>',
      explanation: "Get a user's information card",
      matcher: (cmd: MatcherCommand) => cmd.command == 'usercard',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'usercard',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'usercard' || !msg.guild) return;
        const mentioned_member = msg.guild.members.cache.get(cmd.user);
        let mentioned_user;
        try {
          mentioned_user = await client.users.fetch(cmd.user);
        } catch (e) {
          throw new util_functions.BotError('user', 'Failed to get user');
        }
        if (!mentioned_member)
          msg.dbReply(
            util_functions.embed(
              "User doesn't seem to be in this server, information display will be limited",
              'warning'
            )
          );
        const mm_nick =
          mentioned_member?.displayName || mentioned_user.username;
        const mute_role = mutes
          ? mutes.getMuteRole.get(msg.guild.id)
          : undefined;
        const desc: Array<string> = [];
        let use_pronouns = false;
        if (mute_role && mentioned_member) {
          if (mentioned_member.roles.cache.get(mute_role.role)) {
            desc.push(`${mentioned_member} is muted.`);
            use_pronouns = true;
          } else {
            desc.push(`${mentioned_member} is not muted.`);
            use_pronouns = true;
          }
        }

        const time_in_server = mentioned_member
          ? moment(mentioned_member.joinedAt).fromNow()
          : null;
        if (time_in_server) {
          desc.push(
            `${
              use_pronouns ? 'They' : mentioned_member
            } joined this server ${time_in_server}.`
          );
          use_pronouns = true;
        }
        desc.push(
          `${
            use_pronouns
              ? 'They'
              : mentioned_member
              ? mentioned_member
              : mentioned_user.username
          } joined discord ${moment(mentioned_user.createdAt).fromNow()}.`
        );
        const usernotes = db
          .prepare('SELECT * FROM notes WHERE user=? AND server=? AND type=?')
          .all(mentioned_member?.id || cmd.user, msg.guild.id, 'note')
          .map((n: { message: string }) => n.message);
        const userwarns = db
          .prepare('SELECT * FROM notes WHERE user=? AND server=? AND type=?')
          .all(mentioned_member?.id || cmd.user, msg.guild.id, 'warn')
          .map((n: { message: string }) => n.message);
        msg.dbReply(
          new Discord.MessageEmbed()
            .setAuthor(mm_nick, mentioned_user.displayAvatarURL())
            .setDescription(desc.join(' '))
            .addFields([
              {
                name: 'Notes',
                value: usernotes.length
                  ? Humanize.truncate(
                      usernotes.map((n: string) => `\`${n}\``).join('\n'),
                      1000,
                      '... (Some notes not displayed)'
                    )
                  : 'None',
                inline: true,
              },
              {
                name: 'Warns',
                value: userwarns.length
                  ? Humanize.truncate(
                      userwarns.map((n: string) => `\`${n}\``).join('\n'),
                      1000,
                      '... (Some warns not displayed)'
                    )
                  : 'None',
                inline: true,
              },
            ])
        );
      },
    },
    {
      name: 'note',
      syntax: 'm: note <USER> <REASON>',
      explanation: 'Add a note to a user',
      matcher: (cmd: MatcherCommand) => cmd.command == 'note',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'note',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'note' || !msg.guild) return;
        const id = nanoid.nanoid(5);
        db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run(
          'note',
          cmd.text,
          cmd.user,
          msg.guild.id,
          id
        );
        await msg.channel.send(
          util_functions.desc_embed(
            `Added note to <@${cmd.user}>, note ID \`${id}\`!`
          )
        );
        await Types.LogChannel.tryToLog(
          msg,
          `Added note \`${id}\` to <@${cmd.user}>\n> ${cmd.text}`
        );
      },
    },
    {
      name: 'warn',
      syntax: 'm: warn <USER> <REASON>',
      explanation: 'Add a warn to a user',
      matcher: (cmd: MatcherCommand) => cmd.command == 'warn',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'warn',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'warn' || !msg.guild) return;
        const id = nanoid.nanoid(5);
        db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run(
          'warn',
          cmd.text,
          cmd.user,
          msg.guild.id,
          id
        );
        const mentioned_member = msg.guild.members.cache.get(cmd.user);
        if (!mentioned_member)
          throw new util_functions.BotError(
            'user',
            "Can't find user! Have they left the server?"
          );
        try {
          await (await mentioned_member.createDM()).send(
            new Discord.MessageEmbed()
              .setTitle(`You have been warned in ${msg.guild.name}`)
              .setDescription(`**Warn Message:**\n> ${cmd.text}`)
              .setFooter(`Warning ID: ${id}`)
          );
        } catch (e) {
          await msg.dbReply(
            util_functions.desc_embed(
              'Alert: User will not receive a DM for this warn because they have them disabled'
            )
          );
        }
        await msg.dbReply(
          util_functions.desc_embed(
            `Warned <@${cmd.user}>, warning ID \`${id}\``
          )
        );
        await Types.LogChannel.tryToLog(
          msg,
          `Added warning \`${id}\` to <@${cmd.user}>\n> ${cmd.text}`
        );
      },
    },
    {
      name: 'forgive',
      syntax: 'm: forgive <ID>',
      explanation: 'Remove a warn/note',
      matcher: (cmd: MatcherCommand) => cmd.command == 'forgive',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'forgive',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg: util_functions.EMessage, cmd: Command) => {
        if (cmd.command !== 'forgive' || !msg.guild) return;
        const warn_item = db
          .prepare('SELECT * FROM notes WHERE server=? AND id=? ')
          .get(msg.guild.id, cmd.id);
        if (!warn_item) {
          await msg.dbReply(
            util_functions.desc_embed(`Couldn't find ${cmd.id}`)
          );
          return;
        }
        if (warn_item.user == msg.author.id) {
          await msg.dbReply(
            util_functions.desc_embed(
              `You can't forgive ${warn_item.type}s against yourself`
            )
          );
          return;
        }
        db.prepare('DELETE FROM notes WHERE server=? AND id=? ').run(
          msg.guild.id,
          cmd.id
        );
        await msg.dbReply(util_functions.desc_embed(`Removed ${cmd.id}`));
        await Types.LogChannel.tryToLog(msg, `Removed warn/note \`${cmd.id}\``);
      },
    },
  ],
};
function reminderEmbed(
  userId: string,
  origAuthor: Discord.GuildMember | null,
  text: string,
  message: string | undefined
): Discord.MessageOptions {
  return {
    content: `<@${userId}>`,
    embed: new Discord.MessageEmbed()
      .setTitle('New Reminder!')
      .setDescription(
        text + (message ? '\n\n[Jump to message](' + message + ')' : '')
      )
      .setAuthor(
        origAuthor ? origAuthor.displayName : '',
        origAuthor?.user.displayAvatarURL()
      )
      .setColor('#3e8ac5'),
  };
}
client.on('ready', async () => {
  if (!client.user) {
    console.error('No client user!');
    return;
  }
  console.log(`Logged in as ${client.user.tag}!`);
  processDeferredOnStart(client);
  //
  //
  const sp = () => {
    if (!client.user) return;
    client.user.setPresence({
      activity: {
        name: `m: help | in ${client.guilds.cache.size} servers with ${client.users.cache.size} users`,
        type: 'PLAYING',
        url: 'https://github.com/scratchyone/modbot',
      },
    });
  };
  sp();
  setInterval(sp, 1000 * 60 * 60);
  //
  //
  //
  setInterval(async () => {
    const ts = Math.round(Date.now() / 1000);
    const events = db
      .prepare('SELECT * FROM timerevents WHERE timestamp<=?')
      .all(ts);
    for (const event_item of events) {
      const event = JSON.parse(event_item.event);
      if (event.type == 'reminder') {
        try {
          const res = await Types.Reminder.query()
            .where('author', event.user)
            .where('id', event.id);
          const subs = await Types.ReminderSubscriber.query().where(
            'id',
            event.id
          );
          console.log(subs);
          if (res.length) {
            const c = client.channels.cache.get(
              event.channel
            ) as Discord.TextChannel;
            if (c) {
              const origAuthor = c.guild.member(event.user);
              await c.send(
                reminderEmbed(event.user, origAuthor, event.text, event.message)
              );
              if (subs.length) {
                await (client.channels.cache.get(
                  event.channel
                ) as Discord.TextChannel).send(
                  subs.map((sub) => `<@${sub.user}> `).join('')
                );
              }
            } else {
              for (const user of [...subs.map((n) => n.user), event.user]) {
                try {
                  const discordUser = await client.users.fetch(user);
                  if (discordUser) {
                    (await discordUser.createDM()).send(
                      reminderEmbed(user, null, event.text, undefined)
                    );
                  }
                } catch (e) {
                  console.log(e);
                }
              }
            }
          }
          await Types.Reminder.query()
            .where('author', event.user)
            .where('id', event.id)
            .delete();
          await Types.ReminderSubscriber.query().where('id', event.id).delete();
        } catch (e) {
          //
        }
      }
      if (event.type == 'anonunban') {
        try {
          anonchannels.remove_anon_ban.run({
            user: event.user,
            server: event.server,
          });
          const c = client.channels.cache.get(
            event.channel
          ) as Discord.TextChannel;
          if (!c) return;
          await c.send(util_functions.desc_embed(`Unbanned <@${event.user}>!`));
          await Types.LogChannel.tryToLog(
            c.guild,
            `Unbanned <@${event.user}> from anonchannels!`,
            'event'
          );
        } catch (e) {
          //
        }
      }
      if (event.type == 'removeSlowmodePerm') {
        try {
          const channel = client.channels.cache.get(
            event.channel
          ) as Discord.TextChannel;
          channel.updateOverwrite(event.user, {
            SEND_MESSAGES: true,
          });
          db.prepare(
            'DELETE FROM slowmoded_users WHERE user=? AND channel=?'
          ).run(event.user, event.channel);
        } catch (e) {
          console.log(e);
        }
      }
      if (event.type == 'deletechannel') {
        try {
          const channel = client.channels.cache.get(
            event.channel
          ) as Discord.TextChannel;
          await channel.send(
            util_functions.embed('Deleting channel in 5 seconds', 'warning')
          );
          setTimeout(async () => {
            await channel.delete();
          }, 5000);
          await Types.LogChannel.tryToLog(
            channel.guild,
            `Deleted tmpchannel ${channel}`,
            'event'
          );
        } catch (e) {
          //
        }
      }
      if (event.type == 'tmprole') {
        try {
          const channel = client.channels.cache.get(
            event.channel
          ) as Discord.TextChannel;
          const user = channel.guild.members.cache.get(event.user);
          if (!user) return;
          if (event.action === 'add') {
            await user.roles.add(event.role);
            await channel.send(
              util_functions.desc_embed(`Gave <@&${event.role}> to ${user}`)
            );
            await Types.LogChannel.tryToLog(
              channel.guild,
              `Gave <@&${event.role}> to ${user}`,
              'event'
            );
          } else {
            await user.roles.remove(event.role);
            await channel.send(
              util_functions.desc_embed(
                `Removed <@&${event.role}> from ${user}`
              )
            );
            await Types.LogChannel.tryToLog(
              channel.guild,
              `Removed <@&${event.role}> from ${user}`,
              'event'
            );
          }
        } catch (e) {
          console.log(e);
        }
      }
      if (event.type == 'unmute') {
        try {
          const channel = client.channels.cache.get(
            event.channel
          ) as Discord.TextChannel;
          const user = channel.guild.members.cache.get(event.user);
          if (!user) return;
          await user.roles.remove(event.role);
          await channel.send(util_functions.desc_embed(`Unmuted ${user}`));
          await Types.LogChannel.tryToLog(
            channel.guild,
            `Unmuted ${user}`,
            'event'
          );
        } catch (e) {
          console.log(e);
        }
      }
      if (event.type == 'unlockdown') {
        try {
          const channel = client.channels.cache.get(
            event.channel
          ) as Discord.TextChannel;
          const perm = db
            .prepare('SELECT * FROM locked_channels WHERE channel=?')
            .get(channel.id);
          await channel.overwritePermissions(JSON.parse(perm.permissions));
          await channel.send('Unlocked!');
          db.prepare('DELETE FROM locked_channels WHERE channel=?').run(
            channel.id
          );
          await Types.LogChannel.tryToLog(
            channel.guild,
            `Unlocked ${channel}`,
            'event'
          );
        } catch (e) {
          console.log(e);
        }
      }
    }
    db.prepare('DELETE FROM timerevents WHERE timestamp<=?').run(ts);
  }, 2000);
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.id === client.user?.id) return;
  try {
    // When we receive a reaction we check if the reaction is partial or not
    if (reaction.partial) {
      // If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
      try {
        await reaction.fetch();
      } catch (error) {
        console.log('Something went wrong when fetching the message: ', error);
        // Return as `reaction.message.author` may be undefined/null
        return;
      }
    }
    if (!reaction.message.guild) return;
    const member = reaction.message.guild.member(user as Discord.User);
    const roles_that_can_pin = check_if_can_pin.all();
    if (
      member &&
      member.roles.cache.find(
        (n) =>
          roles_that_can_pin.filter(
            (rcp: { roleid: string; id: string; guild: string }) =>
              rcp.roleid == n.id && rcp.guild == reaction.message.guild?.id
          ).length > 0
      ) &&
      reaction.emoji.name == '📌' &&
      !reaction.message.pinned
    ) {
      try {
        reaction.message
          .pin()
          .catch((e) =>
            setTimeout(
              () =>
                reaction.message.channel.send(
                  util_functions.desc_embed(`Failed to pin: ${e}`)
                ),
              2000
            )
          );
        const pm = (
          await reaction.message.channel.awaitMessages(
            (n: Discord.Message) => n.system,
            {
              max: 1,
              time: 1000,
            }
          )
        ).first();
        if (pm) {
          await pm.delete();
          await reaction.message.channel.send(
            util_functions.desc_embed(
              `${user} pinned [a message](${reaction.message.url}) to this channel`
            )
          );
        }
      } catch (e) {
        await reaction.message.channel.send(
          util_functions.desc_embed(`Failed to pin: ${e}`)
        );
      }
    }
    let rr = check_for_reactionrole.get(
      reaction.emoji.name,
      reaction.message.id,
      reaction.message.guild.id
    );
    if (!rr)
      rr = check_for_reactionrole.get(
        reaction.emoji.id,
        reaction.message.id,
        reaction.message.guild.id
      );
    if (!user.bot && rr) {
      const member = reaction.message.guild.member(user as Discord.User);
      try {
        if (member) await member.roles.add(rr.role);
      } catch (e) {
        if (
          alertchannels?.check_for_alert_channel.get(reaction.message.guild.id)
        ) {
          const tmp = reaction.message.guild.channels.cache.get(
            alertchannels?.check_for_alert_channel.get(
              reaction.message.guild.id
            ).channel
          );
          if (tmp && tmp.type == 'text')
            (tmp as Discord.TextChannel).send(
              util_functions.desc_embed(
                `Warning: Failed to give <@&${rr.role}> to ${user} on reaction role`
              )
            );
        }
      }
    } else if (
      !user.bot &&
      check_for_reactionrole_msg.get(
        reaction.message.id,
        reaction.message.guild.id
      )
    ) {
      await reaction.remove();
    }
  } catch (e) {
    console.log(e);
    Sentry.configureScope(function (scope: SentryTypes.Scope) {
      scope.setUser({
        id: user.id.toString(),
        username: user.tag ? user.tag.toString() : 'NO TAG',
      });
    });
    Sentry.captureException(e);
  }
});
client.on('channelCreate', async (channel) => {
  try {
    await mutes.onChannelCreate(channel);
  } catch (e) {
    //
  }
});
client.on('messageReactionRemove', async (reaction, user) => {
  if (!reaction.message.guild) return;
  try {
    // When we receive a reaction we check if the reaction is partial or not
    if (reaction.partial) {
      // If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
      try {
        await reaction.fetch();
      } catch (error) {
        console.log('Something went wrong when fetching the message: ', error);
        // Return as `reaction.message.author` may be undefined/null
        return;
      }
    }
    const member = reaction.message.guild.member(user as Discord.User);
    const roles_that_can_pin = check_if_can_pin.all();
    if (
      member &&
      member.roles.cache.find(
        (n) =>
          roles_that_can_pin.filter(
            (rcp: { roleid: string; id: string; guild: string }) =>
              rcp.roleid == n.id && rcp.guild == reaction.message.guild?.id
          ).length > 0
      ) &&
      reaction.emoji.name == '📌' &&
      reaction.message.pinned
    ) {
      await reaction.message.unpin();
      await reaction.message.channel.send(
        util_functions.desc_embed(
          `${user} unpinned [a message](${reaction.message.url}) from this channel`
        )
      );
    }
    const rr =
      check_for_reactionrole.get(
        reaction.emoji.name,
        reaction.message.id,
        reaction.message.guild.id
      ) ||
      check_for_reactionrole.get(
        reaction.emoji.id,
        reaction.message.id,
        reaction.message.guild.id
      );
    if (!user.bot && rr && rr.removable) {
      const member = reaction.message.guild.member(user as Discord.User);
      try {
        if (member) await member.roles.remove(rr.role);
      } catch (e) {
        if (
          alertchannels?.check_for_alert_channel.get(reaction.message.guild.id)
        ) {
          const tmp = reaction.message.guild.channels.cache.get(
            alertchannels?.check_for_alert_channel.get(
              reaction.message.guild.id
            ).channel
          );
          if (tmp)
            (tmp as Discord.TextChannel).send(
              util_functions.desc_embed(
                `Warning: Failed to remove <@&${rr.role}> from ${user} on reaction role`
              )
            );
        }
      }
    }
  } catch (e) {
    Sentry.configureScope(function (scope: SentryTypes.Scope) {
      scope.setUser({
        id: user.id.toString(),
        username: user.tag ? user.tag.toString() : 'NO TAG',
      });
    });
    Sentry.captureException(e);
  }
});
import fs from 'fs';
const all_command_modules = [
  main_commands,
  ...fs
    .readdirSync(__dirname + '/submodules')
    .map((mod) => require(__dirname + '/submodules/' + mod).commandModule),
];
for (const module of all_command_modules) {
  if (module.cog) module.cog(client);
}
client.on('guildMemberAdd', async (member) => {
  if (
    db.prepare('SELECT * FROM join_roles WHERE server=?').get(member.guild.id)
  )
    member.roles.add(
      db.prepare('SELECT * FROM join_roles WHERE server=?').get(member.guild.id)
        .role
    );
});
client.on(
  'messageDelete',
  async (msg: Discord.Message | Discord.PartialMessage) => {
    const message = msg as util_functions.EMessage;
    const bm = await Types.BotMessage.query().where('message', msg.id);
    if (
      bm.length &&
      !(await message.getPluralKitSender()) &&
      !db
        .prepare('SELECT * FROM anonchannels WHERE id=?')
        .get(msg.channel.id) &&
      msg.author?.id !== '757021641040724070' // Not overseeer
    ) {
      try {
        for (const m of bm) {
          console.log(m);
          await (await msg.channel.messages.fetch(m.botMessage)).delete();
        }
      } catch (e) {
        console.error(e);
      }
    }
  }
);
function sendAlphaResult(
  ctx: Types.Context,
  cmd: { command: 'alpha'; text: string }
) {
  ctx.msg.dbReply(
    new Discord.MessageEmbed()
      .setTitle('Result')
      .setDescription(ctx.store.get(`alpha.${cmd.text}`) as string)
      .setAuthor(
        'Wolfram Alpha',
        'https://media.discordapp.net/attachments/745460367173484624/765623618297790464/wolfram-alpha-2-569293.png',
        'https://www.wolframalpha.com/'
      )
      .setColor('#4269cc')
  );
}

function getArrayRandomElement<T>(arr: Array<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function addReactOnMention(msg: Discord.Message) {
  if (!client.user) return;
  if (msg.mentions.has(client.user, { ignoreEveryone: true }))
    msg.react(
      getArrayRandomElement([
        '759186176094765057',
        '759943179175854100',
        '759943973338087425',
        '736452416282689617',
        '736440605311369237',
        '736440605311369237',
        '755599209952182364',
        '759943973375836190',
        '759943973107924995',
        '759943973157470208',
        '759943973514248242',
      ])
    );
}
async function arTextFill(
  text: string,
  msg: Discord.Message,
  variables: Map<string, string | null>
): Promise<string> {
  if (!msg.guild) return text;
  let currText = text.split('{{author}}').join(msg.author.toString());
  for (const item of currText.matchAll(/{{[^}]+}}/g)) {
    if (variables.has(item[0].replace('{{', '').replace('}}', '')))
      currText = currText
        .split(item[0])
        .join(
          await util_functions.cleanPings(
            variables.get(item[0].replace('{{', '').replace('}}', '')) ||
              item[0],
            msg.guild
          )
        );
  }
  return currText;
}
async function processAutoresponders(msg: Discord.Message) {
  const message = msg as util_functions.EMessage;
  if (!msg.guild) return;
  const guildArs = db
    .prepare('SELECT * FROM autoresponders WHERE server = ?')
    .all(msg.guild.id);
  for (const ar of guildArs) {
    const parsedPrompt = AutoResponders.parsePrompt(ar.prompt);
    const [matched, variables] = AutoResponders.parseText(
      msg.content,
      parsedPrompt
    );
    if (matched === true) {
      if (ar.type == 'text')
        message.dbReply(
          await util_functions.cleanPings(
            await arTextFill(ar.text_response, msg, variables),
            msg.guild
          )
        );
      else if (ar.type == 'embed')
        message.dbReply(
          new Discord.MessageEmbed()
            .setTitle(ar.embed_title)
            .setDescription(
              await arTextFill(ar.embed_description, msg, variables)
            )
        );
    }
  }
}
async function getPrefix(msg: Discord.Message): Promise<string | null> {
  if (!msg.guild) return null;
  const prefixes = await Prefix.query().where('server', msg.guild.id);
  prefixes.push(Prefix.newPrefix(msg.guild.id, 'm: '));
  const matchingPrefixes = prefixes.filter((p: Prefix) =>
    msg.content.startsWith(p.prefix)
  );
  if (!matchingPrefixes.length) return null;
  return matchingPrefixes.reduce(function (a, b) {
    return a.prefix.length > b.prefix.length ? a : b;
  })?.prefix;
}
async function requestPermsCommand(
  msg: Discord.Message,
  matchingPrefix: string
) {
  if (!msg.guild) return;
  const message = msg as util_functions.EMessage;
  const args = msg.content
    .replace(`${matchingPrefix}requestperms `, '')
    .split(' ');
  const timeParse = parse(args[0], 's');
  if (!timeParse) {
    message.dbReply('Invalid time');
    return;
  }
  const confMsg = await message.dbReply(
    util_functions.desc_embed(
      `${msg.author} would like to request bot permissions for ${args[0]}. A server administrator can react with ✅ to confirm`
    )
  );
  await confMsg.react('✅');
  const reactions = await confMsg.awaitReactions(
    (reaction: Discord.MessageReaction, user: Discord.User) =>
      !!reaction.message.guild?.members.cache
        .get(user.id)
        ?.hasPermission('ADMINISTRATOR') && reaction.emoji.name === '✅',
    {
      max: 1,
      time: 60000,
    }
  );
  if (reactions.first()) {
    message.dbReply(util_functions.desc_embed('Permissions granted!'));
    adminServerPermissionOverwrites.push({
      guild: msg.guild.id,
      timestamp: Date.now() / 1000 + timeParse,
    });
    return;
  } else {
    confMsg.edit(util_functions.desc_embed('Confirmation failed!'));
    confMsg.reactions.removeAll();
    return;
  }
}
const alertChannelNotifsSent: Set<string> = new Set();
async function noAlertChannelWarning(msg: Discord.Message) {
  if (!msg.guild) return;
  const message = msg as util_functions.EMessage;
  if (
    alertchannels &&
    msg.member?.hasPermission('MANAGE_CHANNELS') &&
    !alertchannels.check_for_alert_channel.get(msg.guild.id) &&
    !alertchannels.check_for_alert_channel_ignore.get(msg.guild.id) &&
    !msg.content.includes('alertchannel') &&
    !alertChannelNotifsSent.has(msg.guild.id + msg.author.id)
  ) {
    // This server does not have an alert channel, has not disabled this warning, and the user has permission to make one
    await message.dbReply(
      util_functions.embed(
        "You don't have an alert channel setup. This is very important for the bot to be able to warn you if there is an issue. Please set one up with `m: alertchannel enable`, or type `m: alertchannel ignore` to stop getting this message",
        'warning'
      )
    );
    alertChannelNotifsSent.add(msg.guild.id + msg.author.id);
  }
}
async function runHelpCommands(
  msg: Discord.Message,
  matchingPrefix: string
): Promise<boolean> {
  const message = msg as util_functions.EMessage;
  if (msg.content == `${matchingPrefix}help`) {
    const chunks = all_command_modules
      .map((mod) => {
        const cmds = mod.commands
          .filter(
            (command: { permissions: (arg0: Discord.Message) => boolean }) =>
              command.permissions(msg) ||
              adminServerPermissionOverwrites.find(
                (p) =>
                  p.timestamp > Date.now() / 1000 &&
                  p.guild === msg.guild?.id &&
                  msg.author.id === '234020040830091265'
              )
          )
          .map(
            (cmd: { syntax: string }) =>
              `\`${cmd.syntax.replace('m: ', matchingPrefix)}\``
          )
          .join('\n');
        return {
          name: mod.title,
          value: '*' + mod.description + '*\n' + cmds,
          inline: false,
          cmds: cmds,
        };
      })
      .filter((n) => n.cmds.length);
    //.chunk_inefficient(25);
    message.dbReply(
      new Discord.MessageEmbed()
        .setTitle(util_functions.fillStringVars('Help for __botName__'))
        .setDescription(
          '<> means required, [] means optional. Type `' +
            matchingPrefix +
            'help <NAME>` to get help for a specific command module or command'
        )
        .addFields(chunks)
    );
    return true;
  } else if (msg.content.startsWith(`${matchingPrefix}help `)) {
    const chosen_module = all_command_modules.find(
      (mod) =>
        mod.title.toLowerCase() ==
        msg.content.replace(`${matchingPrefix}help `, '').toLowerCase()
    );
    if (!chosen_module) {
      for (const module of all_command_modules) {
        for (const registered_command of module.commands)
          try {
            if (
              registered_command.name.toLowerCase() ==
              msg.content.replace(`${matchingPrefix}help `, '').toLowerCase()
            ) {
              message.dbReply(
                new Discord.MessageEmbed()
                  .setTitle(
                    util_functions.fillStringVars('Help for __botName__')
                  )
                  .setDescription(
                    '**' +
                      Humanize.capitalize(registered_command.name) +
                      '**\n' +
                      (registered_command.explanation ||
                        registered_command.long_explanation) +
                      '\n*<> means required, [] means optional.*'
                  )
                  .addField(
                    'Syntax',
                    `\`${registered_command.syntax.replace(
                      'm: ',
                      matchingPrefix
                    )}\``
                  )
              );
              return true;
            }
          } catch (e) {}
      }
      await message.dbReply('Module/Command not found!');
      return true;
    }
    message.dbReply(
      new Discord.MessageEmbed()
        .setTitle(util_functions.fillStringVars('Help for __botName__'))
        .setDescription(
          '**' +
            chosen_module.title +
            '**\n' +
            chosen_module.description +
            '\n*<> means required, [] means optional.*\nType ' +
            matchingPrefix +
            'help <NAME> to get help for a specific command'
        )
        .addFields(
          chosen_module.commands
            .filter(
              (command: { permissions: (arg0: Discord.Message) => boolean }) =>
                command.permissions(msg) ||
                adminServerPermissionOverwrites.find(
                  (p) =>
                    p.timestamp > Date.now() / 1000 &&
                    p.guild === msg.guild?.id &&
                    msg.author.id === '234020040830091265'
                )
            )
            .map((n: { name: string; syntax: string; explanation: string }) => {
              return {
                name: Humanize.capitalize(n.name),
                value: `\`${n.syntax.replace('m: ', matchingPrefix)}\`\n${
                  n.explanation
                }`,
                inline: false,
              };
            })
        )
    );
    return true;
  }
  return false;
}
async function showSyntaxError(
  msg: Discord.Message,
  input: string,
  matchingPrefix: string
): Promise<boolean> {
  const message = msg as util_functions.EMessage;
  for (const module of all_command_modules) {
    for (const registered_command of module.commands)
      try {
        if (
          registered_command.simplematcher(
            input.replace(matchingPrefix, '').toLowerCase().split(' ')
          )
        ) {
          await message.dbReply(
            new Discord.MessageEmbed()
              .setTitle('Syntax Error')
              .setColor('#e74d4d')
              .setDescription(
                `**Help:**\n\`${registered_command.syntax.replace(
                  'm: ',
                  matchingPrefix
                )}\`\n*${
                  registered_command.long_explanation ||
                  registered_command.explanation
                }*`
              )
          );
          return true;
        }
      } catch (e) {}
  }
  return false;
}
function logStats(msg: Discord.Message) {
  const mrt = store.getOrSet('stats.msgResponseTimes', []) as Array<number>;
  mrt.push(new Date().getTime() - msg.createdAt.getTime());
  store.set('stats.msgResponseTimes', mrt);
}
async function checkDisabledCommand(msg: Discord.Message, command: string) {
  if (!msg.guild) return;
  if (
    (
      await Types.DisabledCommand.query()
        .where('server', msg.guild.id)
        .where('command', command)
    ).length
  )
    throw new util_functions.BotError(
      'user',
      'Sorry, that command has been disabled by a server moderator'
    );
}
interface ParseObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
function processObjects(
  parseRes: ParseObject,
  version: number,
  msg: Discord.Message
): ParseObject {
  if (!msg.guild) return {};
  const outputObj: ParseObject = {};
  for (const key in parseRes) {
    const value = parseRes[key];
    if (value?.type === 'channel_id')
      if (version <= 2) outputObj[key] = value.id;
      else {
        const m = msg.guild.channels.cache.get(value.id);
        if (!m) throw new util_functions.BotError('user', 'Channel not found');
        outputObj[key] = m;
      }
    else if (value?.type === 'channel_name') {
      const m = msg.guild.channels.cache.find(
        (c) => c.name === value.name && c.type === 'text'
      );
      if (!m) throw new util_functions.BotError('user', 'Channel not found');
      if (version <= 2) outputObj[key] = m.id;
      else {
        outputObj[key] = m;
      }
    } else if (value?.type === 'role_name') {
      const m = msg.guild.roles.cache.find((c) => c.name === value.name);
      if (!m) throw new util_functions.BotError('user', 'Role not found');
      if (version <= 2) outputObj[key] = m.id;
      else {
        outputObj[key] = m;
      }
    } else if (value?.type === 'role_id')
      if (version <= 2) outputObj[key] = value.id;
      else {
        const m = msg.guild.roles.cache.get(value.id);
        if (!m) throw new util_functions.BotError('user', 'Role not found');
        outputObj[key] = m;
      }
    else outputObj[key] = value;
  }
  return outputObj;
}
const adminServerPermissionOverwrites: Array<{
  guild: string;
  timestamp: number;
}> = [];
import Humanize, { toFixed } from 'humanize-plus';
import { Defer, processDeferredOnStart } from './defer';
client.on('message', async (msg: Discord.Message) => {
  // Force msg to EMessage because it *always* will be an EMessage
  const message = msg as util_functions.EMessage;
  try {
    if (!msg.guild) return;
    if (!client.user) return;
    // In a guild and logged in
    addReactOnMention(msg);
    if (msg.author.id === client.user.id) return;
    // Message author is not ModBot
    if (automod) automod.checkForTriggers(msg);
    if (msg.author.bot && msg.author.id !== '757021641040724070') return; // Overseer exemption
    // Message author is not a bot
    anonchannels.onNewMessage(msg);
    processAutoresponders(msg);
    const matchingPrefix = await getPrefix(msg);
    if (!matchingPrefix) return;
    // A prefix has matched, this is a command
    noAlertChannelWarning(msg);
    if (
      msg.content.startsWith(`${matchingPrefix}requestperms `) &&
      msg.author.id === '234020040830091265'
    ) {
      // User is bot owner and has run the requestperms meta command
      await requestPermsCommand(msg, matchingPrefix);
      return;
    }
    if (await runHelpCommands(msg, matchingPrefix)) return;
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(commands));

    try {
      parser.feed(msg.content.replace(matchingPrefix, ''));
    } catch (e) {
      await showSyntaxError(msg, msg.content, matchingPrefix);
    }
    const results = parser.results;
    for (const module of all_command_modules) {
      for (const registered_command of module.commands)
        try {
          if (
            results.length &&
            results[0].length &&
            registered_command.matcher(results[0][0])
          ) {
            try {
              if (
                registered_command.permissions(msg) ||
                adminServerPermissionOverwrites.find(
                  (p) =>
                    p.timestamp > Date.now() / 1000 &&
                    p.guild === msg.guild?.id &&
                    msg.author.id === '234020040830091265'
                )
              ) {
                logStats(msg);
                await checkDisabledCommand(msg, results[0][0].command);
                if (
                  registered_command.version === 2 ||
                  registered_command.version === 3
                ) {
                  const result = await registered_command.responder(
                    new Types.Context(
                      msg,
                      await util_functions.cleanPings(
                        matchingPrefix,
                        msg.guild
                      ),
                      client,
                      store,
                      all_command_modules.flatMap((mod) =>
                        mod.commands.map((c: { name: string }) => c.name)
                      )
                    ),
                    processObjects(
                      results[0][0],
                      registered_command.version || 1,
                      msg
                    ),
                    client,
                    db
                  );
                  const cancelMsg = await msg.channel.awaitMessages(
                    (m) =>
                      m.author.id === msg.author.id && m.content === 'cancel',
                    { time: 20000, max: 1 }
                  );
                  if (cancelMsg.array().length) {
                    if (typeof result === 'object' && result.length > 0) {
                      for (const func of result) {
                        await func();
                      }
                      message.dbReply(
                        util_functions.embed(
                          'Finished cancelling!',
                          'success',
                          'Cancelled'
                        )
                      );
                    } else
                      throw new util_functions.BotError(
                        'user',
                        "Sorry, that command can't be cancelled"
                      );
                  }
                } else
                  await registered_command.responder(
                    msg,
                    processObjects(
                      results[0][0],
                      registered_command.version || 1,
                      msg
                    ),
                    client,
                    db
                  );
              } else {
                throw new util_functions.BotError(
                  'user',
                  "You don't have permission to run that command"
                );
              }
            } catch (e) {
              if (e.type == 'user') {
                await message.dbReply(
                  new Discord.MessageEmbed()
                    .setColor('#e74d4d')
                    .setTitle('Error')
                    .setDescription(e.message)
                    .setFooter(
                      `Use ${matchingPrefix}support to get an invite to the support server`
                    )
                );
              } else if (e.type == 'bot') {
                await message.dbReply(
                  'An error has occurred. Would you please explain what you were trying to do?'
                );
                const feedback = await msg.channel.awaitMessages(
                  (n) => n.author.id == msg.author.id,
                  { max: 1, time: 20000 }
                );
                Sentry.configureScope(function (scope: SentryTypes.Scope) {
                  scope.setTag('command', results[0][0].command);
                  scope.setUser({
                    id: msg.author.id.toString(),
                    username: msg.author.tag.toString(),
                  });
                  scope.setContext('Info', {
                    'Message Text': msg.content,
                    'Parse Result': results[0][0],
                    Feedback: feedback.array()[0]
                      ? feedback.array()[0].content
                      : null,
                  });
                });
                await message.dbReply(
                  "There's been an error! Luckily, it's not your fault. Please give the bot owner this ID: " +
                    Sentry.captureException(e)
                );
                await message.dbReply(
                  `Use \`${matchingPrefix}support\` to get an invite to the support server`
                );
              } else {
                if (e.httpStatus === 403) {
                  await message.dbReply(
                    util_functions.desc_embed(
                      `**Sorry! ModBot doesn't have permission to do that! Maybe check on my permission settings? Currently ModBot works best with the Administrator permission and must be as close to the top of the role list as possible**\nError: ${e}`
                    )
                  );
                } else {
                  console.error(e);
                  await message.dbReply(
                    'An error has occurred. Would you please explain what you were trying to do?'
                  );
                  const feedback = await msg.channel.awaitMessages(
                    (n) => n.author.id == msg.author.id,
                    { max: 1, time: 30000 }
                  );
                  Sentry.configureScope(function (scope: SentryTypes.Scope) {
                    scope.setTag('command', results[0][0].command);
                    scope.setUser({
                      id: msg.author.id.toString(),
                      username: msg.author.tag.toString(),
                    });
                    scope.setContext('Info', {
                      'Message Text': msg.content,
                      'Parse Result': results[0][0],
                      Feedback: feedback.array()[0]
                        ? feedback.array()[0].content
                        : null,
                    });
                  });
                  await message.dbReply(
                    'This error is likely not your fault. Please give the bot owner this ID: ' +
                      Sentry.captureException(e)
                  );
                  await message.dbReply(
                    `Use \`${matchingPrefix}support\` to get an invite to the support server`
                  );
                }
              }
            }
          } else if (
            registered_command.simplematcher(
              msg.content.replace(matchingPrefix, '').toLowerCase().split(' ')
            )
          ) {
            await showSyntaxError(msg, msg.content, matchingPrefix);
          }
        } catch (e) {
          //
        }
    }
  } catch (e) {
    console.error(e);
    Sentry.configureScope(function (scope: SentryTypes.Scope) {
      scope.setUser({
        id: msg.author.id.toString(),
        username: msg.author.tag.toString(),
      });
      scope.setContext('Info', {
        'Message Text': msg.content,
      });
    });
    Sentry.captureException(e);
  }
});
Web.serve(client);
client.login(process.env.DISCORD_TOKEN);
