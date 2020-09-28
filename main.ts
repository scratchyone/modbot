/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-var-requires */
import Discord from 'discord.js';
const moment = require('moment');
const Sentry = require('@sentry/node');
import SentryTypes from '@sentry/types';
import { Model } from 'objection';
import Knex from 'knex';

// Initialize knex.
const knex = Knex({
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: 'perms.db3',
  },
});

// Give the knex instance to objection.
Model.knex(knex);
require('dotenv').config();
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
const mutes = require('./submodules/mutes.js');
const utilities = require('./submodules/utilities');
const slowmode = require('./submodules/slowmode.js');
const moderation = require('./submodules/moderation');
const starboard = require('./submodules/starboard.js');
const alertchannels = require('./submodules/alertchannels.js');
const automod = require('./submodules/automod.js');
const nanoid = require('nanoid');
const db = require('better-sqlite3')('perms.db3', {});
const check_if_can_pin = db.prepare('SELECT * FROM pinners');
const check_for_ar = db.prepare(
  'SELECT * FROM autoresponders WHERE prompt=? AND server=?'
);
const check_for_reactionrole = db.prepare(
  'SELECT * FROM reactionroles WHERE emoji=? AND message=? AND server=?'
);
const check_for_reactionrole_msg = db.prepare(
  'SELECT * FROM reactionroles WHERE message=? AND server=?'
);
const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const assert = require('assert');
const anonchannels = require('./anonchannels.js');
const util_functions = require('./util_functions.js');
const client = new Discord.Client({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});
const { util } = require('prettier');
const { default: parse } = require('parse-duration');
interface MatcherCommand {
  command: string;
}
import { Command, EMessage, Prefix } from './types';
import * as Types from './types';
const main_commands = {
  title: 'Main Commands',
  description: 'All main bot commands',
  commands: [
    {
      name: 'pin',
      syntax: 'm: pin <MESSAGE>',
      explanation: 'Allows you to pin something anonymously',
      matcher: (cmd: MatcherCommand) => cmd.command == 'pin',
      permissions: (msg: Discord.Message) => {
        msg.member && msg.member.hasPermission('MANAGE_MESSAGES');
      },
      simplematcher: (cmd: Array<string>) => cmd[0] === 'pin',
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'pin') return;
        msg.delete();
        try {
          await (await msg.channel.send(cmd.text)).pin();
        } catch (e) {
          await msg.channel.send(
            util_functions.desc_embed('Failed to pin: ' + e)
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
      responder: async (
        msg: Discord.Message,
        cmd: Command,
        client: Discord.Client
      ) => {
        if (cmd.command !== 'eval') return;
        try {
          const cloneUser = async (user: string, text: string) => {
            if (msg.guild !== null && msg.channel.type == 'text') {
              const uuser = msg.guild.members.cache.get(user);
              if (!uuser) throw new Error('User not found');
              const loghook = await msg.channel.createWebhook(
                uuser.displayName,
                {
                  avatar: uuser.user.displayAvatarURL(),
                }
              );
              await loghook.send(text);
              await loghook.delete();
            }
          };
          const res = eval(
            `(async () => {${cmd.code
              .replace('```js', '')
              .replace('```javascript', '')
              .replace(
                '```',
                ''
              )}})().catch(e=>msg.channel.send(\`Error: \${e}\`)).then(r=>r ? msg.channel.send(r) : 'Ran')`
          );
        } catch (e) {
          msg.channel.send(util_functions.desc_embed(`Error: ${e}`));
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
        msg.member && msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'say') return;
        if (!msg.guild)
          throw new util_functions.BotError('user', 'No guild found');
        if (!cmd.keep)
          util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        if (
          anonchannels.check_anon_channel.get(
            cmd.channel ? cmd.channel : msg.channel.id,
            msg.guild.id
          ) &&
          anonchannels.check_anon_ban.get({
            user: msg.author.id,
            server: msg.guild.id,
          })
        ) {
          const bm = await msg.channel.send(
            util_functions.desc_embed(
              `${msg.author}, you're banned from sending messages there!`
            )
          );
          setTimeout(async () => await bm.delete(), 2000);
        } else {
          if (!cmd.keep) await msg.delete();
          const chan = msg.guild.channels.cache.find(
            (n) => n.id == (cmd.channel ? cmd.channel : msg.channel.id)
          );
          if (!chan || chan.type !== 'text')
            throw new util_functions.BotError('user', 'Channel is not found!');
          await (chan as Discord.TextChannel).send(cmd.text);
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'setanonchannel') return;
        if (!msg.guild || !msg.guild.id) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        const channel = cmd.channel ? cmd.channel : msg.channel.id;
        if (!msg.guild)
          if (cmd.enabled) {
            db.prepare(
              'INSERT INTO anonchannels VALUES (@channel, @server)'
            ).run({
              channel: channel,
              server: (msg.guild as Discord.Guild).id,
            });
          } else {
            db.prepare('DELETE FROM anonchannels WHERE id=? AND server=?').run(
              channel,
              (msg.guild as Discord.Guild).id
            );
          }
        msg.channel.send(
          util_functions.desc_embed(
            `${cmd.enabled ? 'Enabled' : 'Disabled'} <#${channel}>`
          )
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
      responder: async (msg: Discord.Message) => {
        if (!msg.guild || !msg.guild.id) return;
        const channels = db
          .prepare('SELECT * FROM anonchannels WHERE server=?')
          .all(msg.guild.id);
        if (channels.length == 0) {
          await msg.channel.send('No anon channels');
        } else {
          await msg.channel.send(
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'whosaid') return;
        if (!msg.guild || !msg.guild.id) return;
        const author = db
          .prepare('SELECT * FROM anonmessages WHERE id=? AND server=?')
          .get(cmd.id, msg.guild.id);
        if (author) {
          await msg.channel.send(
            util_functions.desc_embed(`<@${author.user}>`)
          );
        } else {
          await msg.channel.send('No message found');
        }
      },
    },
    {
      name: 'reminder',
      syntax: 'm: reminder add <DURATION> <TEXT> / cancel <ID> / copy <ID>',
      explanation: 'Set/cancel/copy a reminder',
      matcher: (cmd: MatcherCommand) => cmd.command === 'reminder',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'reminder',
      permissions: (msg: Discord.Message) => true,
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'reminder') return;
        if (cmd.action === 'add') {
          const id = nanoid.nanoid(5);
          await Types.Reminder.query().insert({
            author: msg.author.id,
            id,
          });
          util_functions.schedule_event(
            {
              type: 'reminder',
              text: await util_functions.cleanPings(cmd.text, msg.guild),
              channel: msg.channel.id,
              user: msg.author.id,
              id,
            },
            cmd.time
          );
          await msg.channel.send(
            `Set reminder, you can cancel it with \`m: reminder cancel ${id}\`, or somebody else can run \`m: reminder copy ${id}\` to also get reminded`
          );
        } else if (cmd.action === 'copy') {
          const orig = await Types.Reminder.query().where('id', cmd.id);
          if (!orig.length)
            throw new util_functions.BotError('user', 'Reminder not found');
          await Types.ReminderSubscriber.query().insert({
            user: msg.author.id,
            id: cmd.id,
          });
          await msg.channel.send(
            `You will be notifed when the reminder is ready!`
          );
        } else if (cmd.action === 'cancel') {
          await Types.Reminder.query()
            .delete()
            .where('author', msg.author.id)
            .where('id', cmd.id);
          await msg.channel.send(`Cancelled!`);
        }
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
      responder: async (msg: Discord.Message) => {
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
          await msg.channel.send(
            util_functions.desc_embed('Running clonepurge')
          );
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
              await msg.channel.send(util_functions.desc_embed('Finished.'));
            } else if (type === 1) {
              await msg.channel.send(util_functions.desc_embed('Archiving'));
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
              await msg.channel.send(util_functions.desc_embed('Finished.'));
            } else {
              await msg.channel.send(
                util_functions.desc_embed(
                  'Finished. Deleting channel in 10 seconds'
                )
              );
              await sleep(10000);
              await msg.channel.delete();
            }
          } catch (e) {
            await msg.channel.send(
              util_functions.desc_embed(`Clonepurge failed: ${e}`)
            );
            await new_channel.delete();
          }
        };
        if (type === 0) {
          if (await util_functions.confirm(msg)) {
            await clone(type);
          }
        } else if (type !== null) {
          await clone(type);
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
      responder: async (msg: Discord.Message) => {
        util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
        if (msg.channel.id == '707361413894504489') return;
        if (await util_functions.confirm(msg)) {
          msg.channel.send(
            util_functions.desc_embed('Deleting channel in 5 seconds')
          );
          await sleep(5000);
          await msg.channel.delete();
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
      responder: async (msg: Discord.Message, cmd: Command) => {
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
        if (cmd.user == client.user.id && !cmd.allowed) {
          await msg.channel.send('Fuck you');
          return;
        }
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
          await msg.channel.send("Sorry, you can't access that channel");
          return;
        }
        const user = msg.guild.member(cmd.user);
        if (!user) throw new util_functions.BotError('user', 'User not found');
        if (!cmd.allowed) {
          await realchannel.updateOverwrite(user, { VIEW_CHANNEL: false });
        } else {
          await realchannel.updateOverwrite(user, { VIEW_CHANNEL: true });
        }
        await msg.channel.send(
          util_functions.desc_embed(
            `${cmd.allowed ? 'Allowed' : 'Disallowed'} ${user} ${
              cmd.allowed ? 'to' : 'from'
            } ${cmd.allowed ? 'read' : 'reading'} messages in ${channel}`
          )
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'archivechannel') return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
        const deleted_category = (msg.guild!.channels.cache.find(
          (n) => n.type == 'category' && n.name == 'archived'
        ) ||
          (await msg.guild!.channels.create('archived', {
            type: 'category',
          }))) as Discord.CategoryChannel;

        if (msg.channel.type !== 'text')
          throw new util_functions.BotError('user', 'Not a text channel');
        await msg.channel.setParent(deleted_category);
        await msg.channel.overwritePermissions([
          {
            id: msg.guild!.id,
            deny: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
          },
          {
            id: cmd.role,
            allow: ['VIEW_CHANNEL'],
          },
        ]);
        await msg.channel.send(util_functions.desc_embed('Archived channel!'));
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'anonban') return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        anonchannels.insert_anon_ban.run({
          user: cmd.user,
          server: msg.guild!.id,
        });
        if (cmd.time) {
          util_functions.schedule_event(
            {
              type: 'anonunban',
              channel: msg.channel.id,
              user: cmd.user,
              server: msg.guild!.id,
            },
            cmd.time
          );
          await msg.channel.send(
            util_functions.desc_embed(`Banned <@${cmd.user}> for ${cmd.time}`)
          );
        } else {
          await msg.channel.send(
            util_functions.desc_embed(`Banned <@${cmd.user}>`)
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'anonunban') return;
        anonchannels.remove_anon_ban.run({
          user: cmd.user,
          server: msg.guild!.id,
        });
        await msg.channel.send(
          util_functions.desc_embed(`Unbanned <@${cmd.user}>`)
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'tmpchannel') return;
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
          channel = await msg.guild!.channels.create(cmd.name, {
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
                    id: msg.guild!.id,
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
          await msg.channel.send(
            util_functions.desc_embed('Failed to create channel: ' + e)
          );
          return;
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
        await msg.channel.send(
          util_functions.desc_embed(`Creating ${channel} for ${cmd.duration}`)
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'setpinperms') return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        if (cmd.allowed) {
          db.prepare('INSERT INTO pinners VALUES (?, ?)').run(
            cmd.role,
            msg.guild!.id
          );
          msg.channel.send(
            util_functions.desc_embed(
              `<@&${cmd.role}> are now allowed to pin messages with :pushpin:`
            )
          );
        } else {
          db.prepare('DELETE FROM pinners WHERE roleid=? AND guild=?').run(
            cmd.role,
            msg.guild!.id
          );
          msg.channel.send(
            util_functions.desc_embed(
              `<@&${cmd.role}> are no longer allowed to pin messages with :pushpin:`
            )
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'listpinperms') return;
        const roles = db
          .prepare('SELECT * FROM pinners WHERE guild=?')
          .all(msg.guild!.id);
        msg.channel.send(
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'autoresponder') return;
        if (cmd.action === 'add') {
          try {
            await msg.channel.send(
              'What message should this AutoResponder reply to?'
            );
            const prompt = await msg.channel.awaitMessages(
              (m) => m.author.id == msg.author.id,
              {
                max: 1,
                time: 10000,
              }
            );
            if (!prompt.array().length) {
              await msg.channel.send(util_functions.desc_embed('Timed out'));
              return;
            }
            const message_type = await util_functions.embed_options(
              'Message type?',
              ['Text', 'Embed'],
              ['📝', '🔗'],
              msg
            );
            if (message_type === 0) {
              await msg.channel.send('What should I reply with?');
              const response = await msg.channel.awaitMessages(
                (m) => m.author.id == msg.author.id,
                {
                  max: 1,
                  time: 10000,
                }
              );
              if (!response.array().length) {
                await msg.channel.send(util_functions.desc_embed('Timed out'));
                return;
              }
              if (response.array()[0].attachments.array().length) {
                await msg.channel.send(
                  util_functions.desc_embed('Attachments are not supported')
                );
                return;
              }
              db.prepare(
                'REPLACE INTO autoresponders(prompt, type, text_response, server) VALUES (?, ?, ?, ?)'
              ).run(
                prompt.array()[0].content,
                'text',
                response.array()[0].content,
                msg.guild!.id
              );
            } else if (message_type === 1) {
              await msg.channel.send('What should the embed title be?');
              const embed_title = await msg.channel.awaitMessages(
                (m) => m.author.id == msg.author.id,
                {
                  max: 1,
                  time: 10000,
                }
              );
              if (!embed_title.array().length) {
                await msg.channel.send(util_functions.desc_embed('Timed out'));
                return;
              }
              await msg.channel.send('What should the embed description be?');
              const embed_desc = await msg.channel.awaitMessages(
                (m) => m.author.id == msg.author.id,
                {
                  max: 1,
                  time: 10000,
                }
              );
              if (!embed_desc.array().length) {
                await msg.channel.send(util_functions.desc_embed('Timed out'));
                return;
              }
              db.prepare(
                'REPLACE INTO autoresponders(prompt, type, embed_title, embed_description, server) VALUES (?, ?, ?, ?, ?)'
              ).run(
                prompt.array()[0].content,
                'embed',
                embed_title.array()[0].content,
                embed_desc.array()[0].content,
                msg.guild!.id
              );
            } else {
              return;
            }
            await msg.channel.send(
              util_functions.desc_embed('Added AutoResponder')
            );
          } catch (e) {
            console.log(e);
            await msg.channel.send(
              util_functions.desc_embed('Failed to create AutoResponder')
            );
          }
        } else if (cmd.action === 'remove') {
          await msg.channel.send(
            'What AutoResponder would you like to remove?'
          );
          const prompt = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 10000,
            }
          );
          if (!prompt.array().length) {
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          const rc = db
            .prepare('DELETE FROM autoresponders WHERE prompt=? AND server=?')
            .run(prompt.array()[0].content, msg.guild!.id);
          if (rc.changes)
            await msg.channel.send(
              util_functions.desc_embed('Removed AutoResponder')
            );
          else
            await msg.channel.send(
              util_functions.desc_embed("Couldn't find AutoResponder")
            );
        } else if (cmd.action === 'list') {
          const ars = db
            .prepare('SELECT * FROM autoresponders WHERE server=?')
            .all(msg.guild!.id);
          await msg.channel.send(
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
      simplematcher: (cmd: Array<string>) => cmd[0] === 'alpha',
      permissions: (msg: Discord.Message) => true,
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'alpha') return;
        try {
          const res = await (
            await nodefetch(
              'http://api.wolframalpha.com/v2/query?appid=KGQK9K-5TT39X9VQ8&input=' +
                encodeURIComponent(cmd.text) +
                '&format=plaintext&output=json'
            )
          ).json();
          console.log(res.queryresult.pods);
          console.log(res.queryresult.pods[1].subpods[0].plaintext);
          msg.channel.send(
            util_functions.desc_embed(
              res.queryresult.pods[1].subpods[0].plaintext
            )
          );
        } catch (e) {
          msg.channel.send(util_functions.desc_embed('Failed'));
        }
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'joinroles') return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
        if (cmd.action === 'enable') {
          if (
            db
              .prepare('SELECT * FROM join_roles WHERE server=?')
              .get(msg.guild!.id)
          ) {
            await msg.channel.send(
              'This server already has a join role. You can disable it with `m: joinroles disable`'
            );
            return;
          }
          await msg.channel.send(
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
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          const rrole = role
            .array()[0]
            .content.replace('<@&', '')
            .replace('>', '');
          const disc_role = msg.guild!.roles.cache.get(rrole);
          if (!disc_role) {
            await msg.channel.send("Role doesn't exist!");
            return;
          }
          db.prepare('INSERT INTO join_roles VALUES (?, ?)').run(
            msg.guild!.id,
            role
          );
          await msg.channel.send(util_functions.desc_embed('Setup!'));
        } else if (cmd.action === 'disable') {
          if (
            !db
              .prepare('SELECT * FROM join_roles WHERE server=?')
              .get(msg.guild!.id)
          ) {
            await msg.channel.send("This server doesn't have a join role.");
            return;
          }
          db.prepare('DELETE FROM join_roles WHERE server=?').run(
            msg.guild!.id
          );
          await msg.channel.send(util_functions.desc_embed('Disabled!'));
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'reactionroles') return;
        util_functions.assertHasPerms(msg.guild, [
          'MANAGE_ROLES',
          'MANAGE_MESSAGES',
        ]);
        if (cmd.action === 'add') {
          await msg.channel.send(
            'What channel would you like the message to be in?'
          );

          const chan = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 20000,
            }
          );
          if (!chan.array().length) {
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          const cchan = chan
            .array()[0]
            .content.replace('<#', '')
            .replace('>', '');
          await msg.channel.send('What should the embed title be?');
          const embed_title = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 20000,
            }
          );
          if (!embed_title.array().length) {
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          await msg.channel.send('What should the embed description be?');
          const embed_description = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 70000,
            }
          );
          if (!embed_description.array().length) {
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          await msg.channel.send(
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
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          let rr_mes;
          try {
            const tmp_chan = msg.guild!.channels.cache.get(cchan);
            if (!tmp_chan || tmp_chan.type !== 'text') {
              await msg.channel.send(
                util_functions.desc_embed("Channel doesn't exist!")
              );
              return;
            }
            rr_mes = await (tmp_chan as Discord.TextChannel).send(
              new Discord.MessageEmbed()
                .setTitle(embed_title.array()[0].content)
                .setDescription(embed_description.array()[0].content)
            );
          } catch (e) {
            await msg.channel.send(
              util_functions.desc_embed("Couldn't send message!")
            );
            return;
          }
          const hp = msg.member!.roles.highest.position;
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
            const serv_role = msg.guild!.roles.cache.get(react.role);
            if (!serv_role)
              throw new util_functions.BotError(
                'user',
                `${react.role} does not exist`
              );
            if (serv_role.position >= hp) {
              await msg.channel.send(
                util_functions.desc_embed(
                  'Your highest role position is below one of the roles you tried to add'
                )
              );
              return;
            }
          }
          for (const react of reacts_formatted) {
            const serv_role = msg.guild!.roles.cache.get(react.role);
            if (react.emoji.includes('<')) {
              const em = msg.guild!.emojis.cache.find(
                (n) => `<:${n.name}:${n.id}>` == react.emoji
              );
              if (!em) {
                await msg.channel.send(
                  util_functions.desc_embed(
                    'Emoji not found. You can only use emojis from this server'
                  )
                );
                await rr_mes.delete();
                return;
              }
            }
          }
          for (const react of reacts_formatted) {
            const serv_role = msg.guild!.roles.cache.get(react.role);
            if (!react.emoji.includes('<')) {
              await rr_mes.react(react.emoji);
              db.prepare('INSERT INTO reactionroles VALUES (?, ?, ?, ?)').run(
                rr_mes.id,
                msg.guild!.id,
                react.emoji,
                react.role
              );
            } else {
              const em = msg.guild!.emojis.cache.find(
                (n) => `<:${n.name}:${n.id}>` == react.emoji
              );
              db.prepare('INSERT INTO reactionroles VALUES (?, ?, ?, ?)').run(
                rr_mes.id,
                msg.guild!.id,
                em!.id,
                react.role
              );
              await rr_mes.react(em!.id);
            }
          }
          await msg.channel.send(util_functions.desc_embed('Added!'));
        } else if (cmd.action === 'edit') {
          await msg.channel.send('What channel is the message in?');
          const chan = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 20000,
            }
          );
          if (!chan.array().length) {
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          const cchan = chan
            .array()[0]
            .content.replace('<#', '')
            .replace('>', '');
          await msg.channel.send('What is the message ID?');
          const mid = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 20000,
            }
          );
          if (!mid.array().length) {
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          let rr_mes;
          try {
            rr_mes = await (msg.guild!.channels.cache.get(
              cchan!
            )! as Discord.TextChannel).messages.fetch(mid.array()[0].content);
          } catch (e) {
            await msg.channel.send(
              util_functions.desc_embed("Couldn't find message")
            );
            return;
          }
          await msg.channel.send('What should the embed title be?');
          const embed_title = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 20000,
            }
          );
          if (!embed_title.array().length) {
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          await msg.channel.send('What should the embed description be?');
          const embed_description = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 70000,
            }
          );
          if (!embed_description.array().length) {
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          await rr_mes.edit(
            new Discord.MessageEmbed()
              .setTitle(embed_title.array()[0].content)
              .setDescription(embed_description.array()[0].content)
          );
          await msg.channel.send(
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
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          const hp = msg.member!.roles.highest.position;
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
            const serv_role = msg.guild!.roles.cache.get(react.role);
            if (!serv_role)
              throw new util_functions.BotError(
                'user',
                `${react.role} does not exist`
              );
            if (serv_role.position >= hp) {
              await msg.channel.send(
                util_functions.desc_embed(
                  'Your highest role position is below one of the roles you tried to add'
                )
              );
              return;
            }
          }
          for (const react of reacts_formatted) {
            const serv_role = msg.guild!.roles.cache.get(react.role);
            if (react.emoji.includes('<')) {
              const em = msg.guild!.emojis.cache.find(
                (n) => `<:${n.name}:${n.id}>` == react.emoji
              );
              if (!em) {
                await msg.channel.send(
                  util_functions.desc_embed(
                    'Emoji not found. You can only use emojis from this server'
                  )
                );
                return;
              }
            }
          }
          db.prepare('DELETE FROM reactionroles WHERE message=?').run(
            rr_mes.id
          );
          for (const react of reacts_formatted) {
            const serv_role = msg.guild!.roles.cache.get(react.role);
            if (!react.emoji.includes('<')) {
              await rr_mes.react(react.emoji);
              db.prepare('INSERT INTO reactionroles VALUES (?, ?, ?, ?)').run(
                rr_mes.id,
                msg.guild!.id,
                react.emoji,
                react.role
              );
            } else {
              const em = msg.guild!.emojis.cache.find(
                (n) => `<:${n.name}:${n.id}>` == react.emoji
              );
              db.prepare('INSERT INTO reactionroles VALUES (?, ?, ?, ?)').run(
                rr_mes.id,
                msg.guild!.id,
                em!.id,
                react.role
              );
              await rr_mes.react(em!.id);
            }
          }
          for (const reaction of rr_mes.reactions.cache.array()) {
            let rr = check_for_reactionrole.get(
              reaction.emoji.name,
              reaction.message.id,
              reaction.message.guild!.id
            );
            if (!rr)
              rr = check_for_reactionrole.get(
                reaction.emoji.id,
                reaction.message.id,
                reaction.message.guild!.id
              );
            if (!rr) {
              reaction.remove();
            }
          }
          await msg.channel.send(util_functions.desc_embed('Edited!'));
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'kick') return;
        util_functions.assertHasPerms(msg.guild, ['KICK_MEMBERS']);
        const hp = msg.member!.roles.highest.position;
        const kickee = msg.guild!.members.cache.get(cmd.user);
        if (!kickee)
          throw new util_functions.BotError(
            'user',
            'User not found\nHelp: Have they left the server?'
          );
        const kickee_hp = kickee.roles.highest.position;
        if (kickee_hp >= hp) {
          await msg.channel.send(
            util_functions.desc_embed(
              'Your highest role is below or equal to the user you are tying to kick'
            )
          );
        } else {
          const conf = await util_functions.confirm(msg);
          if (conf) {
            await kickee.kick();
            await msg.channel.send(util_functions.desc_embed('Kicked'));
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'tmprole') return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
        const hp = msg.member!.roles.highest.position;
        const kickee = msg.guild!.members.cache.get(cmd.user);
        if (!kickee)
          throw new util_functions.BotError(
            'user',
            'User not found\nHelp: Have they left the server?'
          );
        const kickee_hp = kickee.roles.highest.position;
        if (kickee_hp >= hp && kickee.id != msg.author.id) {
          await msg.channel.send(
            util_functions.desc_embed(
              'Your highest role is below or equal to the user you are trying to change roles on'
            )
          );
        } else {
          if (cmd.action === 'remove') {
            if (!kickee.roles.cache.get(cmd.role)) {
              await msg.channel.send(
                util_functions.desc_embed(
                  `${kickee} doesn't have <@&${cmd.role}>`
                )
              );
              return;
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
            await msg.channel.send(
              util_functions.desc_embed(
                `Removed <@&${cmd.role}> from ${kickee} for ${cmd.duration}`
              )
            );
          } else if (cmd.action === 'add') {
            const role_to_be_added = msg.guild!.roles.cache.get(cmd.role);
            if (!role_to_be_added) {
              await msg.channel.send(
                util_functions.desc_embed(`<@&${cmd.role}> doesn't exist`)
              );
              return;
            }
            if (hp <= role_to_be_added.position) {
              await msg.channel.send(
                util_functions.desc_embed(
                  `<@&${cmd.role}> is equal to or above you in the role list`
                )
              );
              return;
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
            await msg.channel.send(
              util_functions.desc_embed(
                `Added <@&${cmd.role}> to ${kickee} for ${cmd.duration}`
              )
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'purge') return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        const count = parseInt(cmd.count);
        if (count > 50) {
          await msg.channel.send(
            util_functions.desc_embed(
              'Must be less than or equal to 50 messages'
            )
          );
          return;
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
        } catch (e) {
          await msg.channel.send(util_functions.desc_embed(e));
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'usercard') return;
        const mentioned_member = msg.guild!.members.cache.get(cmd.user);
        if (!mentioned_member)
          msg.channel.send(
            util_functions.desc_embed(
              "Warning: User doesn't seem to be in this server, information display will be limited"
            )
          );
        const mm_nick = mentioned_member?.displayName || cmd.user;
        const mute_role = mutes.getMuteRole.get(msg.guild!.id);
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
        if (time_in_server)
          desc.push(
            `${
              use_pronouns ? 'They' : mentioned_member
            } joined this server ${time_in_server}.`
          );
        const usernotes = db
          .prepare('SELECT * FROM notes WHERE user=? AND server=? AND type=?')
          .all(mentioned_member?.id || cmd.user, msg.guild!.id, 'note')
          .map((n: { message: string }) => n.message);
        const userwarns = db
          .prepare('SELECT * FROM notes WHERE user=? AND server=? AND type=?')
          .all(mentioned_member?.id || cmd.user, msg.guild!.id, 'warn')
          .map((n: { message: string }) => n.message);
        msg.channel.send(
          new Discord.MessageEmbed()
            .setAuthor(mm_nick, mentioned_member?.user.displayAvatarURL())
            .setDescription(desc.join(' '))
            .addFields([
              {
                name: 'Notes',
                value: usernotes.length
                  ? usernotes.map((n: string) => `\`${n}\``).join('\n')
                  : 'None',
                inline: true,
              },
              {
                name: 'Warns',
                value: userwarns.length
                  ? userwarns.map((n: string) => `\`${n}\``).join('\n')
                  : 'None',
                inline: true,
              },
            ])
        );
      },
    },
    {
      name: 'note',
      syntax: 'm: note <USER>',
      explanation: 'Add a note to a user',
      matcher: (cmd: MatcherCommand) => cmd.command == 'note',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'note',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'note') return;
        const id = nanoid.nanoid(5);
        db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run(
          'note',
          cmd.text,
          cmd.user,
          msg.guild!.id,
          id
        );
        await msg.channel.send(
          util_functions.desc_embed(
            `Added note to <@${cmd.user}>, note ID \`${id}\`!`
          )
        );
      },
    },
    {
      name: 'warn',
      syntax: 'm: warn <USER>',
      explanation: 'Add a warn to a user',
      matcher: (cmd: MatcherCommand) => cmd.command == 'warn',
      simplematcher: (cmd: Array<string>) => cmd[0] === 'warn',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'warn') return;
        const id = nanoid.nanoid(5);
        db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run(
          'warn',
          cmd.text,
          cmd.user,
          msg.guild!.id,
          id
        );
        const mentioned_member = msg.guild!.members.cache.get(cmd.user);
        if (!mentioned_member)
          throw new util_functions.BotError(
            'user',
            "Can't find user! Have they left the server?"
          );
        try {
          await (await mentioned_member.createDM()).send(
            new Discord.MessageEmbed()
              .setTitle(`You have been warned in ${msg.guild!.name}`)
              .setDescription(`**Warn Message:**\n\`${cmd.text}\``)
              .setFooter(`Warning ID: ${id}`)
          );
        } catch (e) {
          await msg.channel.send(
            util_functions.desc_embed(
              'Alert: User will not receive a DM for this warn because they have them disabled'
            )
          );
        }
        await msg.channel.send(
          util_functions.desc_embed(`Warned <@${cmd.user}>, warning ID ${id}`)
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
      responder: async (msg: Discord.Message, cmd: Command) => {
        if (cmd.command !== 'forgive') return;
        const warn_item = db
          .prepare('SELECT * FROM notes WHERE server=? AND id=? ')
          .get(msg.guild!.id, cmd.id);
        if (!warn_item) {
          await msg.channel.send(
            util_functions.desc_embed(`Couldn't find ${cmd.id}`)
          );
          return;
        }
        if (warn_item.user == msg.author.id) {
          await msg.channel.send(
            util_functions.desc_embed(
              `You can't forgive ${warn_item.type}s against yourself`
            )
          );
          return;
        }
        db.prepare('DELETE FROM notes WHERE server=? AND id=? ').run(
          msg.guild!.id,
          cmd.id
        );
        await msg.channel.send(util_functions.desc_embed(`Removed ${cmd.id}`));
      },
    },
  ],
};
client.on('ready', async () => {
  console.log(`Logged in as ${client.user!.tag}!`);
  //
  //
  client.user!.setActivity('ẏ̴͍̻o̷͍̗͒̽u̵͔͌͊', { type: 'WATCHING' });
  //
  //
  //
  const pj = require('./package.json');
  if (!db.prepare('SELECT * FROM updates WHERE version=?').get(pj.version)) {
    const changes = pj.changelogs.filter(
      (change: { version: string }) =>
        !db.prepare('SELECT * FROM updates WHERE version=?').get(change.version)
    );
    console.log(changes);

    for (const alertchannel of db
      .prepare('SELECT * FROM alert_channels')
      .all()) {
      const ralertchannel = client.channels.cache.get(alertchannel.channel);
      if (!ralertchannel || ralertchannel.type !== 'text') continue;
      await (ralertchannel as Discord.TextChannel).send(
        new Discord.MessageEmbed()
          .setTitle(`ModBot has been updated to v${pj.version}`)
          .setDescription(
            `**Changes:**\n${changes
              .map((change: { changelog: string }) => change.changelog)
              .join('\n')}`
          )
      );
    }
    for (const change of changes) {
      db.prepare('INSERT INTO updates VALUES (?)').run(change.version);
    }
  }
  setInterval(async () => {
    const ts = Math.round(Date.now() / 1000);
    const events = db
      .prepare('SELECT * FROM timerevents WHERE timestamp<=?')
      .all(ts);
    for (const event_item of events) {
      const event = JSON.parse(event_item.event);
      if (event.type == 'reminder') {
        try {
          let res = await Types.Reminder.query()
            .where('author', event.user)
            .where('id', event.id);
          let subs = await Types.ReminderSubscriber.query().where(
            'id',
            event.id
          );
          console.log(subs);
          if (res.length) {
            await (client.channels.cache.get(
              event.channel
            )! as Discord.TextChannel).send(
              `<@${event.user}>, you have a reminder: ${event.text}`
            );
            if (subs.length) {
              await (client.channels.cache.get(
                event.channel
              )! as Discord.TextChannel).send(
                subs.map((sub) => `<@${sub.user}> `).join('')
              );
            }
          }
          Types.Reminder.query()
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
          await (client.channels.cache.get(
            event.channel
          )! as Discord.TextChannel).send(
            util_functions.desc_embed(`Unbanned <@${event.user}>!`)
          );
        } catch (e) {
          //
        }
      }
      if (event.type == 'removeSlowmodePerm') {
        try {
          const channel = client.channels.cache.get(
            event.channel
          )! as Discord.TextChannel;
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
          )! as Discord.TextChannel;
          await channel.send('Deleting channel in 5 seconds');
          setTimeout(async () => {
            await channel.delete();
          }, 5000);
        } catch (e) {
          //
        }
      }
      if (event.type == 'tmprole') {
        try {
          const channel = client.channels.cache.get(
            event.channel
          )! as Discord.TextChannel;
          const user = channel.guild.members.cache.get(event.user)!;
          if (event.action === 'add') {
            await user.roles.add(event.role);
            await channel.send(
              util_functions.desc_embed(`Gave <@&${event.role}> to ${user}`)
            );
          } else {
            await user.roles.remove(event.role);
            await channel.send(
              util_functions.desc_embed(
                `Removed <@&${event.role}> from ${user}`
              )
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
          )! as Discord.TextChannel;
          const user = channel.guild.members.cache.get(event.user)!;
          await user.roles.remove(event.role);
          await channel.send(util_functions.desc_embed(`Unmuted ${user}`));
        } catch (e) {
          console.log(e);
        }
      }
      if (event.type == 'unlockdown') {
        try {
          const channel = client.channels.cache.get(
            event.channel
          )! as Discord.TextChannel;
          const perm = db
            .prepare('SELECT * FROM locked_channels WHERE channel=?')
            .get(channel.id);
          await channel.overwritePermissions(JSON.parse(perm.permissions));
          await channel.send('Unlocked!');
          db.prepare('DELETE FROM locked_channels WHERE channel=?').run(
            channel.id
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
  const message = reaction.message as EMessage;
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
    if (
      (reaction.emoji.name == '👍' || reaction.emoji.name == '👎') &&
      message.isPoll
    ) {
      const t = reaction.message.reactions.cache
        .array()
        .filter(
          (r) =>
            (r.emoji.name == '👍' || r.emoji.name == '👎') &&
            r.users.cache.array().filter((u) => u.id == user.id).length &&
            r.emoji.name != reaction.emoji.name
        );
      if (t.length) reaction.users.remove(user as Discord.User);
      else await utilities.reRenderPoll(reaction.message, client);
    }
    if (reaction.emoji.name == '⭐') {
      await starboard.onStarReactAdd(reaction, client);
    }
    const member = reaction.message.guild.member(user as Discord.User);
    const roles_that_can_pin = check_if_can_pin.all();
    if (
      member &&
      member.roles.cache.find(
        (n) =>
          roles_that_can_pin.filter(
            (rcp: { roleid: string; id: string; guild: string }) =>
              rcp.roleid == n.id && rcp.guild == reaction.message.guild!.id
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
        const pm = await reaction.message.channel.awaitMessages(
          (n) => true, //n.content.includes('pinned a message to this channel'),
          { max: 1, time: 1000 }
        );
        if (pm.first()) {
          await pm.first()!.delete();
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
        await member!.roles.add(rr.role);
      } catch (e) {
        if (
          alertchannels.check_for_alert_channel.get(reaction.message.guild.id)
        ) {
          const tmp = reaction.message.guild.channels.cache.get(
            alertchannels.check_for_alert_channel.get(reaction.message.guild.id)
              .channel
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
        username: user.tag!.toString(),
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
  const message = reaction.message as EMessage;
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
    if (reaction.emoji.name == '⭐') {
      await starboard.onStarReactRemove(reaction, client);
    }
    if (
      (reaction.emoji.name == '👍' || reaction.emoji.name == '👎') &&
      message.isPoll
    ) {
      const t = reaction.message.reactions.cache
        .array()
        .filter(
          (r) =>
            (r.emoji.name == '👍' || r.emoji.name == '👎') &&
            r.users.cache.array().filter((u) => u.id == user.id).length &&
            r.emoji.name != reaction.emoji.name
        );
      if (!t.length) await utilities.reRenderPoll(reaction.message, client);
    }
    const member = reaction.message.guild.member(user as Discord.User);
    const roles_that_can_pin = check_if_can_pin.all();
    if (
      member &&
      member.roles.cache.find(
        (n) =>
          roles_that_can_pin.filter(
            (rcp: { roleid: string; id: string; guild: string }) =>
              rcp.roleid == n.id && rcp.guild == reaction.message.guild!.id
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
    if (!user.bot && rr) {
      const member = reaction.message.guild.member(user as Discord.User);
      try {
        await member!.roles.remove(rr.role);
      } catch (e) {
        if (
          alertchannels.check_for_alert_channel.get(reaction.message.guild.id)
        ) {
          const tmp = reaction.message.guild.channels.cache.get(
            alertchannels.check_for_alert_channel.get(reaction.message.guild.id)
              .channel
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
        username: user.tag!.toString(),
      });
    });
    Sentry.captureException(e);
  }
});
const all_command_modules = [
  main_commands,
  mutes.commandModule,
  starboard.commandModule,
  utilities.commandModule,
  alertchannels.commandModule,
  moderation.commandModule,
  automod.commandModule,
  slowmode.commandModule,
];
client.on('guildMemberAdd', async (member) => {
  if (
    db.prepare('SELECT * FROM join_roles WHERE server=?').get(member.guild.id)
  )
    member.roles.add(
      db.prepare('SELECT * FROM join_roles WHERE server=?').get(member.guild.id)
        .role
    );
});
const check_autopings = db.prepare('SELECT * FROM autopings WHERE channel=?');
client.on('messageUpdate', async (omsg, nmsg) => {
  if (nmsg.partial) {
    // If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
    try {
      await nmsg.fetch();
    } catch (error) {
      console.log('Something went wrong when fetching the message: ', error);
      // Return as `reaction.message.author` may be undefined/null
      return;
    }
  }
  await starboard.onMessageEdit(omsg, nmsg, client);
});
client.on(
  'messageDelete',
  async (msg: Discord.Message | Discord.PartialMessage) => {
    if (msg.partial) {
      // If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
      try {
        await msg.fetch();
      } catch (error) {
        console.log('Something went wrong when fetching the message: ', error);
        // Return as `reaction.message.author` may be undefined/null
        return;
      }
    }
    await starboard.onMessageDelete(msg, client);
  }
);
client.on(
  'messageDeleteBulk',
  async (
    msgs: Discord.Collection<
      Discord.Snowflake,
      Discord.Message | Discord.PartialMessage
    >
  ) => {
    for (const msg of msgs.array()) {
      if (msg.partial) {
        // If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
        try {
          await msg.fetch();
        } catch (error) {
          console.log(
            'Something went wrong when fetching the message: ',
            error
          );
          // Return as `reaction.message.author` may be undefined/null
          return;
        }
      }
      await starboard.onMessageDelete(msg, client);
    }
  }
);
function getArrayRandomElement<T>(arr: Array<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
client.on('message', async (msg: Discord.Message) => {
  try {
    if (!msg.guild) return;
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
    if (msg.author.id === client.user.id) return;
    await automod.checkForTriggers(msg);
    if (msg.author.bot) return;
    const ap = check_autopings.get(msg.channel.id);
    if (ap) await (await msg.channel.send(ap.message)).delete();
    await slowmode.onMessage(msg);
    /*if (msg.author.id == '671486892457590846') {
      const Canvas = require('canvas');
      const canvas = Canvas.createCanvas(502, 453);
      const ctx = canvas.getContext('2d');
      const background = await Canvas.loadImage('./Mocking-Spongebob.png');
      // This uses the canvas dimensions to stretch the image onto the entire canvas
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
      ctx.font = '25px sans-serif';
      // Select the style that will be used to fill the text in
      ctx.fillStyle = '#000000';
      // Actually fill the text with a solid color
      ctx.textAlign = 'left';
      ctx.fillText(msg.content.toRandomCase(), 10, 40);
      // Use helpful Attachment class structure to process the file for you
      const attachment = new Discord.MessageAttachment(
        canvas.toBuffer(),
        'image.png'
      );
      let im = await msg.channel.send('', attachment);
      setTimeout(() => {
        im.delete();
      }, 30000);
    }*/
    /*if (
    msg.content.startsWith('m: ') &&
    !(await util_functions.checkSelfPermissions(client, msg.guild))
  ) {
    msg.channel.send(
      util_functions.desc_embed('This bot needs admin permissions!')
    );
    return;
  }*/
    if (
      msg.guild &&
      anonchannels.check_anon_channel.get(msg.channel.id, msg.guild.id)
    ) {
      if (
        !anonchannels.check_anon_ban.get({
          user: msg.author.id,
          server: msg.guild.id,
        })
      )
        await anonchannels.handle_anon_message(msg);
      else {
        await msg.delete();
        const bm = await msg.channel.send(
          util_functions.desc_embed(`${msg.author}, you're banned!`)
        );
        setTimeout(async () => await bm.delete(), 2000);
      }
    }
    const ar = check_for_ar.get(msg.content, msg.guild.id);
    if (ar) {
      if (ar.type == 'text') msg.channel.send(ar.text_response);
      else if (ar.type == 'embed')
        msg.channel.send(
          new Discord.MessageEmbed()
            .setTitle(ar.embed_title)
            .setDescription(ar.embed_description)
        );
    }
    const prefixes = await Prefix.query().where('server', msg.guild.id);
    const matchingPrefix =
      prefixes.find((p: Prefix) => msg.content.startsWith(p.prefix))?.prefix ||
      (msg.content.startsWith('m: ') ? 'm: ' : null);
    if (!matchingPrefix || msg.author.bot) return;
    if (
      msg.member &&
      msg.member.hasPermission('MANAGE_CHANNELS') &&
      !alertchannels.check_for_alert_channel.get(msg.guild.id) &&
      !alertchannels.check_for_alert_channel_ignore.get(msg.guild.id)
    ) {
      await msg.channel.send(
        util_functions.desc_embed(
          "Warning: You don't have an alert channel setup. This is very important for the bot to be able to warn you if there is an issue. Please set one up with `m: alertchannel enable`, or type `m: alertchannel ignore` to stop getting this message"
        )
      );
    }
    if (msg.content == `${matchingPrefix}help`) {
      const chunks = all_command_modules.map((mod) => {
        const cmds = mod.commands
          .filter(
            (command: { permissions: (arg0: Discord.Message) => boolean }) =>
              command.permissions(msg)
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
        };
      });
      //.chunk_inefficient(25);
      msg.channel.send(
        new Discord.MessageEmbed()
          .setTitle(util_functions.fillStringVars('Help for __botName__'))
          .setDescription(
            '<> means required, [] means optional. Type `' +
              matchingPrefix +
              'help <NAME>` to get help for a specific command module'
          )
          .addFields(chunks)
      );
      return;
    } else if (msg.content.startsWith(`${matchingPrefix}help `)) {
      const chosen_module = all_command_modules.find(
        (mod) =>
          mod.title.toLowerCase() ==
          msg.content.replace(`${matchingPrefix}help `, '').toLowerCase()
      );
      if (!chosen_module) {
        await msg.channel.send('Module not found!');
        return;
      }
      msg.channel.send(
        new Discord.MessageEmbed()
          .setTitle(util_functions.fillStringVars('Help for __botName__'))
          .setDescription(
            '**' +
              chosen_module.title +
              '**\n' +
              chosen_module.description +
              '\n*<> means required, [] means optional.*'
          )
          .addFields(
            chosen_module.commands.map(
              (n: { name: string; syntax: string; explanation: string }) => {
                return {
                  name: n.name,
                  value: `\`${n.syntax.replace('m: ', matchingPrefix)}\`\n${
                    n.explanation
                  }`,
                  inline: false,
                };
              }
            )
          )
      );
      return;
    }
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(commands));
    const showSyntaxError = async (input: string): Promise<boolean> => {
      for (const module of all_command_modules) {
        for (const registered_command of module.commands)
          try {
            if (
              registered_command.simplematcher(
                input.replace(matchingPrefix, '').split(' ')
              )
            ) {
              await msg.channel.send(
                new Discord.MessageEmbed()
                  .setTitle('Syntax Error')
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
    };
    try {
      parser.feed(msg.content.replace(matchingPrefix, ''));
      console.log(parser.results[0]);
    } catch (e) {
      const foundSyntax = await showSyntaxError(msg.content);
      if (!foundSyntax) {
        console.log(e);
        msg.channel.send(
          new Discord.MessageEmbed()
            .setTitle('Command not found')
            .setDescription(
              `Use \`${matchingPrefix}help\` to view all commands`
            )
        );
      }
    }
    const results = parser.results;
    /*await msg.channel.send(util_functions.desc_embed(
    'Parsed command as:\n```json\n' + JSON.stringify(results[0][0]) + '```'
 ));*/
    for (const module of all_command_modules) {
      for (const registered_command of module.commands)
        try {
          if (
            results.length &&
            results[0].length &&
            registered_command.matcher(results[0][0])
          ) {
            try {
              if (registered_command.permissions(msg))
                await registered_command.responder(
                  msg,
                  results[0][0],
                  client,
                  db
                );
            } catch (e) {
              if (e.type == 'user')
                await msg.channel.send(util_functions.desc_embed(e.message));
              else if (e.type == 'bot') {
                await msg.channel.send(
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
                await msg.channel.send(
                  util_functions.desc_embed(
                    "There's been an error! Luckily, it's not your fault. Please give the bot owner this ID: " +
                      Sentry.captureException(e)
                  )
                );
              } else {
                console.log(e);
                if (e.httpStatus === 403) {
                  await msg.channel.send(
                    util_functions.desc_embed(
                      `**Sorry! ModBot doesn't have permission to do that! Maybe check on my permission settings? Currently ModBot works best with the Administrator permission and must be as close to the top of the role list as possible**\nError: ${e}`
                    )
                  );
                } else {
                  await msg.channel.send(
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
                  await msg.channel.send(
                    util_functions.desc_embed(
                      'This error is likely not your fault. Please give the bot owner this ID: ' +
                        Sentry.captureException(e)
                    )
                  );
                }
              }
            }
          } else if (
            registered_command.simplematcher(
              msg.content.replace(matchingPrefix, '').split(' ')
            )
          ) {
            await showSyntaxError(msg.content);
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
/*client.on('typingStart', async (channel, user) => {
  if (anonchannels.check_anon_channel.get(channel.id, channel.guild.id)) {
    let anonnick = anonchannels.check_anon_nick.get(user.id, channel.guild.id);
    if (!anonnick) {
      let member = await channel.guild.member(user);
      anonchannels.insert_anon_nick.run(
        user.id,
        channel.guild.id,
        member.nickname
      );
      await member.setNickname('Anon');
    }
  } else {
    await anonchannels.fixNick(user, channel.guild);
  }
});*/
client.login(process.env.DISCORD_TOKEN);
/*
var express = require('express');
var cors = require('cors');
var app = express();
app.use(cors());
app.use(express.json());
app.get('/servers/', async (req, res, next) => {
  let guilds = client.guilds.cache.array();
  let servers_data = guilds.map((guild) => {
    let starboard = db
      .prepare('SELECT * FROM starboards WHERE server=?')
      .get(guild.id);
    let sb_channel;
    if (starboard) {
      sb_channel = client.channels.cache.get(starboard.channel);
    }
    return {
      name: guild.name,
      image:
        guild.iconURL() ||
        'https://www.androidcentral.com/sites/androidcentral.com/files/styles/small/public/article_images/2019/04/discord-logo-gplay.png',
      info: {
        starboard: {
          enabled: !!starboard,
          channel: {
            name: sb_channel && sb_channel.name,
            id: sb_channel && sb_channel.id,
          },
          starsRequired: starboard && starboard.stars,
          messageCount: db
            .prepare('SELECT * FROM starboard_messages WHERE server=?')
            .all(guild.id).length,
          has_perms: true,
        },
      },
      id: guild.id,
    };
  });
  res.json({ error: false, servers: servers_data });
});
app.post('/starboard/setstars', async (req, res, next) => {
  let channel = client.channels.cache.get(req.body.channel);
  if (
    req.body.stars == '' ||
    isNaN(req.body.stars) ||
    parseInt(req.body.stars) <= 0
  ) {
    res.json({ error: true });
    return;
  }

  db.prepare('UPDATE starboards SET stars=? WHERE channel=?').run(
    req.body.stars,
    req.body.channel
  );

  res.json({ error: false });
});
app.post('/starboard/setchannel', async (req, res, next) => {
  let channel = client.channels.cache.get(req.body.channel);
  let server = client.guilds.cache.get(req.body.server);
  if (channel.guild.id != server.id) {
    res.json({ error: true });
    return;
  }
  await channel.overwritePermissions([
    {
      id: server.id,
      deny: ['SEND_MESSAGES'],
    },
    {
      id: client.user.id,
      allow: ['SEND_MESSAGES'],
    },
  ]);
  db.prepare('UPDATE starboards SET channel=? WHERE server=?').run(
    req.body.channel,
    req.body.server
  );
  db.prepare('DELETE FROM starboard_messages WHERE server=?').run(
    req.body.server
  );
  res.json({ error: false });
});
app.post('/starboard/disable/', async (req, res, next) => {
  let server = client.guilds.cache.get(req.body.server);
  db.prepare('DELETE FROM starboards WHERE server=?').run(req.body.server);
  db.prepare('DELETE FROM starboard_messages WHERE server=?').run(
    req.body.server
  );
  res.json({ error: false });
});
app.get('/servers/:server/channels/', async (req, res, next) => {
  let server;
  try {
    server = client.guilds.cache.get(req.params.server);
  } catch (e) {
    res.json({
      error: false,
      error_message: 'Invalid server',
    });
    return;
  }
  res.json({
    error: false,
    channels: server.channels.cache
      .array()
      .filter((channel) => channel.type == 'text')
      .map((channel) => {
        return { name: channel.name, id: channel.id };
      }),
  });
});
if (process.env.PORT) {
  app.listen(process.env.PORT, function () {
    console.log('CORS-enabled web server listening on port 80');
  });
}
*/
if (process.env.STATUSTRACKER_URL) {
  const reportStatus = async () => {
    try {
      const res = await (
        await nodefetch(process.env.STATUSTRACKER_URL + '/ping', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'ModBot',
            secret: process.env.STATUSTRACKER_SECRET,
          }),
        })
      ).json();
      if (res.error) {
        console.error('Failed to update statustracker: ' + res.error);
      }
    } catch (e) {
      console.error('Failed to update statustracker: ' + e);
    }
  };
  reportStatus();
  setInterval(async () => {
    await reportStatus();
  }, parseInt(process.env.STATUSTRACKER_TIME_MS!));
}
