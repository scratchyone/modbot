const Discord = require('discord.js');
var moment = require('moment');
var isEmoji = require('is-standard-emoji');
const Sentry = require('@sentry/node');
require('dotenv').config();
Sentry.init({
  dsn: process.env.SENTRY_TOKEN,
  beforeSend: (event) => {
    if (!process.env.SENTRY_TOKEN) {
      console.error(event);
      return null; // this drops the event and nothing will be send to sentry
    }
    return event;
  },
});
moment.relativeTimeThreshold('ss', 15);
var parse_duration = require('parse-duration');

const fetch = require('node-fetch');
const nearley = require('nearley');
const commands = require('./commands.js');
const mutes = require('./submodules/mutes.js');
const utilities = require('./submodules/utilities.js');
const moderation = require('./submodules/moderation.js');
const starboard = require('./submodules/starboard.js');
const alertchannels = require('./submodules/alertchannels.js');
const automod = require('./submodules/automod.js');
let nanoid = require('nanoid');
const db = require('better-sqlite3')('perms.db3', {});
let check_if_can_pin = db.prepare('SELECT * FROM pinners');
let check_for_ar = db.prepare(
  'SELECT * FROM autoresponders WHERE prompt=? AND server=?'
);
let check_for_reactionrole = db.prepare(
  'SELECT * FROM reactionroles WHERE emoji=? AND message=? AND server=?'
);
let check_for_reactionrole_msg = db.prepare(
  'SELECT * FROM reactionroles WHERE message=? AND server=?'
);
let numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let anonchannels = require('./anonchannels.js');
let util_functions = require('./util_functions.js');
const client = new Discord.Client({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});
const { util } = require('prettier');
const { default: parse } = require('parse-duration');
let main_commands = {
  title: 'Main Commands',
  description: 'All main bot commands',
  commands: [
    {
      name: 'pin',
      syntax: 'm: pin <MESSAGE>',
      explanation: 'Allows you to pin something anonymously',
      matcher: (cmd) => cmd.command == 'pin',
      permissions: (msg) => msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg, cmd) => {
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
      matcher: (cmd) => cmd.command == 'eval',
      permissions: (msg) =>
        msg.author.id === '234020040830091265' &&
        msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg, cmd, client) => {
        try {
          let res = eval(
            `(async () => {${cmd.code
              .replace('```js', '')
              .replace('```javascript', '')
              .replace(
                '```',
                ''
              )}})().catch(e=>msg.channel.send(\`Error: \${e}\`)).then(r=>r && msg.channel.send(r))`
          );
          await msg.channel.send('Ran!');
        } catch (e) {
          msg.channel.send(util_functions.desc_embed(`Error: ${e}`));
        }
      },
    },
    {
      name: 'say',
      syntax: 'm: say [CHANNEL] <keep/remove> <TEXT>',
      explanation: 'Make the bot say something in a channel',
      matcher: (cmd) => cmd.command == 'say',
      permissions: (msg) => msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg, cmd) => {
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
          let bm = await msg.channel.send(
            util_functions.desc_embed(
              `${msg.author}, you're banned from sending messages there!`
            )
          );
          setTimeout(async () => await bm.delete(), 2000);
        } else {
          if (!cmd.keep) await msg.delete();
          await msg.guild.channels.cache
            .find((n) => n.id == (cmd.channel ? cmd.channel : msg.channel.id))
            .send(cmd.text);
        }
      },
    },
    {
      name: 'setanonchannel',
      syntax: 'm: setanonchannel <enabled/disabled> [CHANNEL]',
      explanation:
        'Add/Remove an anonymous channel. If no channel is provided it will use the current channel',
      matcher: (cmd) => cmd.command == 'setanonchannel',
      permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg, cmd) => {
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        let channel = cmd.channel ? cmd.channel : msg.channel.id;
        if (cmd.enabled) {
          db.prepare('INSERT INTO anonchannels VALUES (@channel, @server)').run(
            {
              channel: channel,
              server: msg.guild.id,
            }
          );
        } else {
          db.prepare('DELETE FROM anonchannels WHERE id=? AND server=?').run(
            channel,
            msg.guild.id
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
      matcher: (cmd) => cmd.command == 'listanonchannels',
      permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg, cmd) => {
        let channels = db
          .prepare('SELECT * FROM anonchannels WHERE server=?')
          .all(msg.guild.id);
        if (channels.length == 0) {
          await msg.channel.send('No anon channels');
        } else {
          await msg.channel.send(
            channels
              .map((channel) => `${channel.id} -> <#${channel.id}>`)
              .join('\n')
          );
        }
      },
    },
    {
      name: 'whosaid',
      syntax: 'm: whosaid',
      explanation: 'See who sent an anon message',
      matcher: (cmd) => cmd.command == 'whosaid',
      permissions: (msg) => msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg, cmd) => {
        let author = db
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
      syntax: 'm: reminder <DURATION> <TEXT>',
      explanation: 'Set a reminder',
      matcher: (cmd) => cmd.command == 'reminder',
      permissions: (msg) => true,
      responder: async (msg, cmd) => {
        util_functions.schedule_event(
          {
            type: 'reminder',
            text: await util_functions.cleanPings(cmd.text, msg.guild),
            channel: msg.channel.id,
            user: msg.author.id,
          },
          cmd.time
        );
        await msg.channel.send('Set reminder!');
      },
    },
    {
      name: 'clonepurge',
      syntax: 'm: clonepurge',
      explanation: 'Purge a channels entire history',
      matcher: (cmd) => cmd.command == 'clonepurge',
      permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg, cmd) => {
        util_functions.assertHasPerms(msg.guild, [
          'MANAGE_MESSAGES',
          'MANAGE_CHANNELS',
        ]);
        let type = await util_functions.embed_options(
          'What should I do to the original channel?',
          ['Delete', 'Archive', 'Nothing'],
          ['🗑️', '📂', '💾'],
          msg
        );
        let clone = async (type) => {
          await msg.channel.send(
            util_functions.desc_embed('Running clonepurge')
          );
          let new_channel = await msg.channel.clone();
          await new_channel.setPosition(msg.channel.position);
          await new_channel.setTopic(msg.channel.topic);
          await new_channel.send(util_functions.desc_embed('CLONING PINS'));
          let pins = (await msg.channel.messages.fetchPinned()).array();
          pins.reverse();
          let anonhook = await new_channel.createWebhook('ClonePurgeHook');
          try {
            for (let pin of pins) {
              //console.log(pin);
              let msg_username = pin.author.username;
              try {
                msg_username = (await msg.guild.member(pin.author)).nickname;
                if (!msg_username) {
                  msg_username = pin.author.username;
                }
              } catch (e) {
                //
              }
              await (
                await anonhook.send(pin.content, {
                  embeds: pin.embeds,
                  files: pin.attachments.array().map((n) => n.url),
                  username: msg_username,
                  avatarURL: await pin.author.displayAvatarURL(),
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
              await msg.channel.setParent(deleted_catergory);
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
      matcher: (cmd) => cmd.command == 'deletechannel',
      permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg, cmd) => {
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
      matcher: (cmd) => cmd.command == 'channeluser',
      permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg, cmd) => {
        util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
        let channel = client.channels.cache.get(
          cmd.channel ? cmd.channel : msg.channel.id
        );
        if (cmd.user == client.user.id ** !cmd.allowed) {
          await msg.channel.send('Fuck you');
          return;
        }
        if (!channel.permissionsFor(msg.member).has('VIEW_CHANNEL')) {
          await msg.channel.send("Sorry, you can't access that channel");
          return;
        }
        let user = msg.guild.member(cmd.user);
        if (!cmd.allowed) {
          await channel.updateOverwrite(user, { VIEW_CHANNEL: false });
        } else {
          await channel.updateOverwrite(user, { VIEW_CHANNEL: true });
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
      matcher: (cmd) => cmd.command == 'archivechannel',
      permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg, cmd) => {
        util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
        let deleted_catergory = msg.guild.channels.cache.find(
          (n) => n.type == 'category' && n.name == 'archived'
        );
        if (!deleted_catergory) {
          deleted_catergory = await msg.guild.channels.create('archived', {
            type: 'category',
          });
        }
        await msg.channel.setParent(deleted_catergory);
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
        await msg.channel.send(util_functions.desc_embed('Archived channel!'));
      },
    },
    {
      name: 'anonban',
      syntax: 'm: anonban <USER> [TIME]',
      explanation: 'Ban a user from going anonymous',
      matcher: (cmd) => cmd.command == 'anonban',
      permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg, cmd) => {
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
      matcher: (cmd) => cmd.command == 'anonunban',
      permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg, cmd) => {
        anonchannels.remove_anon_ban.run({
          user: cmd.user,
          server: msg.guild.id,
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
      matcher: (cmd) => cmd.command == 'tmpchannel',
      permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
      responder: async (msg, cmd) => {
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
          await msg.channel.send(
            util_functions.desc_embed('Failed to create channel: ' + e)
          );
          return;
        }
        util_functions.schedule_event(
          { type: 'deletechannel', channel: channel.id },
          cmd.duration
        );
        let deletion_time = moment().add(parse_duration(cmd.duration));
        let tm_text = `Deleting channel ${deletion_time.fromNow()}`;
        let time_message = await channel.send(
          util_functions.desc_embed(tm_text)
        );
        await time_message.pin();
        let ei = setInterval(async () => {
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
      matcher: (cmd) => cmd.command == 'setpinperms',
      permissions: (msg) => msg.member.hasPermission('MANAGE_ROLES'),
      responder: async (msg, cmd) => {
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        if (cmd.allowed) {
          db.prepare('INSERT INTO pinners VALUES (?, ?)').run(
            cmd.role,
            msg.guild.id
          );
          msg.channel.send(
            util_functions.desc_embed(
              `<@&${cmd.role}> are now allowed to pin messages with :pushpin:`
            )
          );
        } else {
          db.prepare('DELETE FROM pinners WHERE roleid=? AND guild=?').run(
            cmd.role,
            msg.guild.id
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
      matcher: (cmd) => cmd.command == 'listpinperms',
      permissions: (msg) => msg.member.hasPermission('MANAGE_ROLES'),
      responder: async (msg, cmd) => {
        let roles = db
          .prepare('SELECT * FROM pinners WHERE guild=?')
          .all(msg.guild.id);
        msg.channel.send(
          util_functions.desc_embed(
            roles.map((n) => `${n.roleid} (<@&${n.roleid}>)`).join('\n') ||
              'None'
          )
        );
      },
    },
    {
      name: 'autoresponder',
      syntax: 'm: autoresponder <add/remove/list>',
      explanation: 'Configure the AutoResponder',
      matcher: (cmd) => cmd.command == 'autoresponder',
      permissions: (msg) => msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg, cmd) => {
        if (cmd.action === 'add') {
          try {
            await msg.channel.send(
              'What message should this AutoResponder reply to?'
            );
            let prompt = await msg.channel.awaitMessages(
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
            let message_type = await util_functions.embed_options(
              'Message type?',
              ['Text', 'Embed'],
              ['📝', '🔗'],
              msg
            );
            if (message_type === 0) {
              await msg.channel.send('What should I reply with?');
              let response = await msg.channel.awaitMessages(
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
                msg.guild.id
              );
            } else if (message_type === 1) {
              await msg.channel.send('What should the embed title be?');
              let embed_title = await msg.channel.awaitMessages(
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
              let embed_desc = await msg.channel.awaitMessages(
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
                msg.guild.id
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
          let prompt = await msg.channel.awaitMessages(
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
          let rc = db
            .prepare('DELETE FROM autoresponders WHERE prompt=? AND server=?')
            .run(prompt.array()[0].content, msg.guild.id);
          if (rc.changes)
            await msg.channel.send(
              util_functions.desc_embed('Removed AutoResponder')
            );
          else
            await msg.channel.send(
              util_functions.desc_embed("Couldn't find AutoResponder")
            );
        } else if (cmd.action === 'list') {
          let ars = db
            .prepare('SELECT * FROM autoresponders WHERE server=?')
            .all(msg.guild.id);
          await msg.channel.send(
            util_functions.desc_embed(
              ars ? ars.map((n) => `${n.prompt}`).join('\n') : 'None'
            )
          );
        }
      },
    },
    {
      name: 'alpha',
      syntax: 'm: alpha <TEXT>',
      explanation: 'Query Wolfram Alpha',
      matcher: (cmd) => cmd.command == 'alpha',
      permissions: (msg) => true,
      responder: async (msg, cmd) => {
        try {
          let res = await (
            await fetch(
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
      matcher: (cmd) => cmd.command == 'joinroles',
      permissions: (msg) => msg.member.hasPermission('MANAGE_ROLES'),
      responder: async (msg, cmd) => {
        util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
        if (cmd.action === 'enable') {
          if (
            db
              .prepare('SELECT * FROM join_roles WHERE server=?')
              .get(msg.guild.id)
          ) {
            await msg.channel.send(
              'This server already has a join role. You can disable it with `m: joinroles disable`'
            );
            return;
          }
          await msg.channel.send(
            'What role would you like to set as the join role?'
          );
          let role = await msg.channel.awaitMessages(
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
          role = role.array()[0].content.replace('<@&', '').replace('>', '');
          let disc_role = msg.guild.roles.cache.get(role);
          if (!disc_role) {
            await msg.channel.send("Role doesn't exist!");
            return;
          }
          db.prepare('INSERT INTO join_roles VALUES (?, ?)').run(
            msg.guild.id,
            role
          );
          await msg.channel.send(util_functions.desc_embed('Setup!'));
        } else if (cmd.action === 'disable') {
          if (
            !db
              .prepare('SELECT * FROM join_roles WHERE server=?')
              .get(msg.guild.id)
          ) {
            await msg.channel.send("This server doesn't have a join role.");
            return;
          }
          db.prepare('DELETE FROM join_roles WHERE server=?').run(msg.guild.id);
          await msg.channel.send(util_functions.desc_embed('Disabled!'));
        }
      },
    },
    {
      name: 'reactionroles',
      syntax: 'm: reactionroles <add/edit>',
      explanation: 'Configure reaction roles',
      matcher: (cmd) => cmd.command == 'reactionroles',
      permissions: (msg) => msg.member.hasPermission('MANAGE_ROLES'),
      responder: async (msg, cmd) => {
        util_functions.assertHasPerms(msg.guild, [
          'MANAGE_ROLES',
          'MANAGE_MESSAGES',
        ]);
        if (cmd.action === 'add') {
          await msg.channel.send(
            'What channel would you like the message to be in?'
          );

          let chan = await msg.channel.awaitMessages(
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
          chan = chan.array()[0].content.replace('<#', '').replace('>', '');
          await msg.channel.send('What should the embed title be?');
          let embed_title = await msg.channel.awaitMessages(
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
          let embed_description = await msg.channel.awaitMessages(
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
          let reacts = await msg.channel.awaitMessages(
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
            rr_mes = await msg.guild.channels.cache
              .get(chan)
              .send(
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
          let hp = msg.guild.member(msg.author).roles.highest.position;
          console.log(hp);
          let reacts_formatted = reacts
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
          for (react of reacts_formatted) {
            // Check role levels
            let serv_role = msg.guild.roles.cache.get(react.role);
            if (serv_role.position >= hp) {
              await msg.channel.send(
                util_functions.desc_embed(
                  'Your highest role position is below one of the roles you tried to add'
                )
              );
              return;
            }
          }
          for (react of reacts_formatted) {
            let serv_role = msg.guild.roles.cache.get(react.role);
            if (react.emoji.includes('<')) {
              let em = msg.guild.emojis.cache.find(
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
          for (react of reacts_formatted) {
            let serv_role = msg.guild.roles.cache.get(react.role);
            if (!react.emoji.includes('<')) {
              await rr_mes.react(react.emoji);
              db.prepare('INSERT INTO reactionroles VALUES (?, ?, ?, ?)').run(
                rr_mes.id,
                msg.guild.id,
                react.emoji,
                react.role
              );
            } else {
              let em = msg.guild.emojis.cache.find(
                (n) => `<:${n.name}:${n.id}>` == react.emoji
              );
              db.prepare('INSERT INTO reactionroles VALUES (?, ?, ?, ?)').run(
                rr_mes.id,
                msg.guild.id,
                em.id,
                react.role
              );
              await rr_mes.react(em.id);
            }
          }
          await msg.channel.send(util_functions.desc_embed('Added!'));
        } else if (cmd.action === 'edit') {
          await msg.channel.send('What channel is the message in?');
          let chan = await msg.channel.awaitMessages(
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
          chan = chan.array()[0].content.replace('<#', '').replace('>', '');
          await msg.channel.send('What is the message ID?');
          let mid = await msg.channel.awaitMessages(
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
            rr_mes = await msg.guild.channels.cache
              .get(chan)
              .messages.fetch(mid.array()[0].content);
          } catch (e) {
            await msg.channel.send(
              util_functions.desc_embed("Couldn't find message")
            );
            return;
          }
          await msg.channel.send('What should the embed title be?');
          let embed_title = await msg.channel.awaitMessages(
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
          let embed_description = await msg.channel.awaitMessages(
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
          let reacts = await msg.channel.awaitMessages(
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
          let hp = msg.guild.member(msg.author).roles.highest.position;
          console.log(hp);
          let reacts_formatted = reacts
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
          for (react of reacts_formatted) {
            // Check role levels
            let serv_role = msg.guild.roles.cache.get(react.role);
            if (serv_role.position >= hp) {
              await msg.channel.send(
                util_functions.desc_embed(
                  'Your highest role position is below one of the roles you tried to add'
                )
              );
              return;
            }
          }
          for (react of reacts_formatted) {
            let serv_role = msg.guild.roles.cache.get(react.role);
            if (react.emoji.includes('<')) {
              let em = msg.guild.emojis.cache.find(
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
          for (react of reacts_formatted) {
            let serv_role = msg.guild.roles.cache.get(react.role);
            if (!react.emoji.includes('<')) {
              await rr_mes.react(react.emoji);
              db.prepare('INSERT INTO reactionroles VALUES (?, ?, ?, ?)').run(
                rr_mes.id,
                msg.guild.id,
                react.emoji,
                react.role
              );
            } else {
              let em = msg.guild.emojis.cache.find(
                (n) => `<:${n.name}:${n.id}>` == react.emoji
              );
              db.prepare('INSERT INTO reactionroles VALUES (?, ?, ?, ?)').run(
                rr_mes.id,
                msg.guild.id,
                em.id,
                react.role
              );
              await rr_mes.react(em.id);
            }
          }
          for (let reaction of rr_mes.reactions.cache.array()) {
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
          await msg.channel.send(util_functions.desc_embed('Edited!'));
        }
      },
    },
    {
      name: 'kick',
      syntax: 'm: kick <USER>',
      explanation: 'Kick a user',
      matcher: (cmd) => cmd.command == 'kick',
      permissions: (msg) => msg.member.hasPermission('KICK_MEMBERS'),
      responder: async (msg, cmd) => {
        util_functions.assertHasPerms(msg.guild, ['KICK_MEMBERS']);
        let hp = msg.member.roles.highest.position;
        let kickee = msg.guild.members.cache.get(cmd.user);
        let kickee_hp = kickee.roles.highest.position;
        if (kickee_hp >= hp) {
          await msg.channel.send(
            util_functions.desc_embed(
              'Your highest role is below or equal to the user you are tying to kick'
            )
          );
        } else {
          let conf = await util_functions.confirm(msg);
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
      matcher: (cmd) => cmd.command == 'tmprole',
      permissions: (msg) => msg.member.hasPermission('MANAGE_ROLES'),
      responder: async (msg, cmd) => {
        util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
        let hp = msg.member.roles.highest.position;
        let kickee = msg.guild.members.cache.get(cmd.user);
        let kickee_hp = kickee.roles.highest.position;
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
            let role_to_be_added = msg.guild.roles.cache.get(cmd.role);
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
      matcher: (cmd) => cmd.command == 'purge',
      permissions: (msg) =>
        msg.channel.permissionsFor(msg.member).has('MANAGE_MESSAGES'),
      responder: async (msg, cmd) => {
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        let count = parseInt(cmd.count);
        if (count > 50) {
          await msg.channel.send(
            util_functions.desc_embed(
              'Must be less than or equal to 50 messages'
            )
          );
          return;
        }
        try {
          let purged_msg_num = await msg.channel.bulkDelete(count + 1);

          let purged_info_msg = await msg.channel.send(
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
      matcher: (cmd) => cmd.command == 'usercard',
      permissions: (msg) => msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg, cmd) => {
        let mentioned_member = await msg.guild.members.cache.get(cmd.user);
        let mm_nick = mentioned_member.displayName;
        let mute_role = mutes.getMuteRole.get(msg.guild.id);
        let desc = [];
        let use_pronouns = false;
        if (mute_role) {
          if (await mentioned_member.roles.cache.get(mute_role.role)) {
            desc.push(`${mentioned_member} is muted.`);
            use_pronouns = true;
          } else {
            desc.push(`${mentioned_member} is not muted.`);
            use_pronouns = true;
          }
        }
        let time_in_server = moment(mentioned_member.joinedAt).fromNow();
        desc.push(
          `${
            use_pronouns ? 'They' : mentioned_member
          } joined this server ${time_in_server}.`
        );
        let usernotes = db
          .prepare('SELECT * FROM notes WHERE user=? AND server=? AND type=?')
          .all(mentioned_member.id, msg.guild.id, 'note')
          .map((n) => n.message);
        let userwarns = db
          .prepare('SELECT * FROM notes WHERE user=? AND server=? AND type=?')
          .all(mentioned_member.id, msg.guild.id, 'warn')
          .map((n) => n.message);
        msg.channel.send(
          new Discord.MessageEmbed()
            .setAuthor(mm_nick, await mentioned_member.user.displayAvatarURL())
            .setDescription(desc.join(' '))
            .addFields([
              {
                name: 'Notes',
                value: usernotes.length
                  ? usernotes.map((n) => `\`${n}\``).join('\n')
                  : 'None',
                inline: true,
              },
              {
                name: 'Warns',
                value: userwarns.length
                  ? userwarns.map((n) => `\`${n}\``).join('\n')
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
      matcher: (cmd) => cmd.command == 'note',
      permissions: (msg) => msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg, cmd) => {
        let id = nanoid.nanoid(5);
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
      },
    },
    {
      name: 'warn',
      syntax: 'm: warn <USER>',
      explanation: 'Add a warn to a user',
      matcher: (cmd) => cmd.command == 'warn',
      permissions: (msg) => msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg, cmd) => {
        let id = nanoid.nanoid(5);
        db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run(
          'warn',
          cmd.text,
          cmd.user,
          msg.guild.id,
          id
        );
        let mentioned_member = await msg.guild.members.cache.get(cmd.user);
        try {
          await (await mentioned_member.createDM()).send(
            new Discord.MessageEmbed()
              .setTitle(`You have been warned in ${msg.guild.name}`)
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
      matcher: (cmd) => cmd.command == 'forgive',
      permissions: (msg) => msg.member.hasPermission('MANAGE_MESSAGES'),
      responder: async (msg, cmd) => {
        let warn_item = db
          .prepare('SELECT * FROM notes WHERE server=? AND id=? ')
          .get(msg.guild.id, cmd.id);
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
          msg.guild.id,
          cmd.id
        );
        await msg.channel.send(util_functions.desc_embed(`Removed ${cmd.id}`));
      },
    },
  ],
};
client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  //
  //
  client.user.setActivity('ẏ̴͍̻o̷͍̗͒̽u̵͔͌͊', { type: 'WATCHING' });
  //
  //
  //
  let pj = require('./package.json');
  if (!db.prepare('SELECT * FROM updates WHERE version=?').get(pj.version)) {
    let changes = pj.changelogs.filter(
      (change) =>
        !db.prepare('SELECT * FROM updates WHERE version=?').get(change.version)
    );
    console.log(changes);

    for (let alertchannel of db.prepare('SELECT * FROM alert_channels').all()) {
      ralertchannel = client.channels.cache.get(alertchannel.channel);
      if (!ralertchannel) continue;
      await ralertchannel.send(
        new Discord.MessageEmbed()
          .setTitle(`ModBot has been updated to v${pj.version}`)
          .setDescription(
            `**Changes:**\n${changes
              .map((change) => change.changelog)
              .join('\n')}`
          )
      );
    }
    for (let change of changes) {
      db.prepare('INSERT INTO updates VALUES (?)').run(change.version);
    }
  }
  setInterval(async () => {
    let ts = Math.round(Date.now() / 1000);
    let events = db
      .prepare('SELECT * FROM timerevents WHERE timestamp<=?')
      .all(ts);
    for (let event_item of events) {
      let event = JSON.parse(event_item.event);
      if (event.type == 'reminder') {
        try {
          await client.channels.cache
            .get(event.channel)
            .send(`<@${event.user}>, you have a reminder: ${event.text}`);
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
          await client.channels.cache
            .get(event.channel)
            .send(util_functions.desc_embed(`Unbanned <@${event.user}>!`));
        } catch (e) {
          //
        }
      }
      if (event.type == 'deletechannel') {
        try {
          let channel = client.channels.cache.get(event.channel);
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
          let channel = client.channels.cache.get(event.channel);
          let user = channel.guild.members.cache.get(event.user);
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
          let channel = client.channels.cache.get(event.channel);
          let user = channel.guild.members.cache.get(event.user);
          await user.roles.remove(event.role);
          await channel.send(util_functions.desc_embed(`Unmuted ${user}`));
        } catch (e) {
          console.log(e);
        }
      }
      if (event.type == 'unlockdown') {
        try {
          let channel = client.channels.cache.get(event.channel);
          let perm = db
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
    if (
      (reaction.emoji.name == '👍' || reaction.emoji.name == '👎') &&
      reaction.message.isPoll
    ) {
      let t = reaction.message.reactions.cache
        .array()
        .filter(
          (r) =>
            (r.emoji.name == '👍' || r.emoji.name == '👎') &&
            r.users.cache.array().filter((u) => u.id == user.id).length &&
            r.emoji.name != reaction.emoji.name
        );
      if (t.length) reaction.users.remove(user);
      else await utilities.reRenderPoll(reaction.message, client);
    }
    if (reaction.emoji.name == '⭐') {
      await starboard.onStarReactAdd(reaction, client);
    }
    let member = reaction.message.guild.member(user);
    let roles_that_can_pin = check_if_can_pin.all();
    if (
      member.roles.cache.find(
        (n) =>
          roles_that_can_pin.filter(
            (rcp) =>
              rcp.roleid == n.id && rcp.guild == reaction.message.guild.id
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
        let pm = await reaction.message.channel.awaitMessages(
          (n) => true, //n.content.includes('pinned a message to this channel'),
          { max: 1, time: 1000 }
        );
        if (pm.first()) {
          await pm.first().delete();
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
      let member = reaction.message.guild.member(user);
      try {
        await member.roles.add(rr.role);
      } catch (e) {
        if (
          alertchannels.check_for_alert_channel.get(reaction.message.guild.id)
        ) {
          reaction.message.guild.channels.cache
            .get(
              alertchannels.check_for_alert_channel.get(
                reaction.message.guild.id
              ).channel
            )
            .send(
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
    Sentry.configureScope(function (scope) {
      scope.setUser({
        id: user.id.toString(),
        username: user.tag.toString(),
      });
    });
    Sentry.captureException(e);
  }
});
client.on('channelCreate', async (channel) => {
  try {
    await mutes.onChannelCreate(channel);
  } catch (e) {}
});
client.on('messageReactionRemove', async (reaction, user) => {
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
      reaction.message.isPoll
    ) {
      let t = reaction.message.reactions.cache
        .array()
        .filter(
          (r) =>
            (r.emoji.name == '👍' || r.emoji.name == '👎') &&
            r.users.cache.array().filter((u) => u.id == user.id).length &&
            r.emoji.name != reaction.emoji.name
        );
      if (!t.length) await utilities.reRenderPoll(reaction.message, client);
    }
    let member = reaction.message.guild.member(user);
    let roles_that_can_pin = check_if_can_pin.all();
    if (
      member.roles.cache.find(
        (n) =>
          roles_that_can_pin.filter(
            (rcp) =>
              rcp.roleid == n.id && rcp.guild == reaction.message.guild.id
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
    let rr =
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
      let member = reaction.message.guild.member(user);
      try {
        await member.roles.remove(rr.role);
      } catch (e) {
        if (
          alertchannels.check_for_alert_channel.get(reaction.message.guild.id)
        ) {
          reaction.message.guild.channels.cache
            .get(
              alertchannels.check_for_alert_channel.get(
                reaction.message.guild.id
              ).channel
            )
            .send(
              util_functions.desc_embed(
                `Warning: Failed to remove <@&${rr.role}> from ${user} on reaction role`
              )
            );
        }
      }
    }
  } catch (e) {
    Sentry.configureScope(function (scope) {
      scope.setUser({
        id: user.id.toString(),
        username: user.tag.toString(),
      });
    });
    Sentry.captureException(e);
  }
});
let all_command_modules = [
  main_commands,
  mutes.commandModule,
  starboard.commandModule,
  utilities.commandModule,
  alertchannels.commandModule,
  moderation.commandModule,
  automod.commandModule,
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
let check_autopings = db.prepare('SELECT * FROM autopings WHERE channel=?');
client.on('message', async (msg) => {
  try {
    if (msg.author.id === client.user.id) return;
    await automod.checkForTriggers(msg);
    if (msg.author.bot) return;
    let ap = check_autopings.get(msg.channel.id);
    if (ap) await (await msg.channel.send(ap.message)).delete();
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
        let bm = await msg.channel.send(
          util_functions.desc_embed(`${msg.author}, you're banned!`)
        );
        setTimeout(async () => await bm.delete(), 2000);
      }
    }
    let ar = check_for_ar.get(msg.content, msg.guild.id);
    if (ar) {
      if (ar.type == 'text') msg.channel.send(ar.text_response);
      else if (ar.type == 'embed')
        msg.channel.send(
          new Discord.MessageEmbed()
            .setTitle(ar.embed_title)
            .setDescription(ar.embed_description)
        );
    }
    if (!msg.content.startsWith('m: ') || msg.author.bot) return;
    if (
      (await msg.member.hasPermission('MANAGE_CHANNELS')) &&
      !alertchannels.check_for_alert_channel.get(msg.guild.id) &&
      !alertchannels.check_for_alert_channel_ignore.get(msg.guild.id)
    ) {
      await msg.channel.send(
        util_functions.desc_embed(
          "Warning: You don't have an alert channel setup. This is very important for the bot to be able to warn you if there is an issue. Please set one up with `m: alertchannel enable`, or type `m: alertchannel ignore` to stop getting this message"
        )
      );
    }
    if (msg.content == 'm: help') {
      let chunks = all_command_modules.map((mod) => {
        let cmds = mod.commands
          .filter((command) => command.permissions(msg))
          .map((cmd) => `\`${cmd.syntax}\``)
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
            '<> means required, [] means optional. Type `m: help <NAME>` to get help for a specific command module'
          )
          .addFields(chunks)
      );
      return;
    } else if (msg.content.startsWith('m: help ')) {
      let chosen_module = all_command_modules.find(
        (mod) =>
          mod.title.toLowerCase() ==
          msg.content.replace('m: help ', '').toLowerCase()
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
            chosen_module.commands.map((n) => {
              return {
                name: n.name,
                value: `\`${n.syntax}\`\n${n.explanation}`,
                inline: false,
              };
            })
          )
      );
      return;
    }
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(commands));
    try {
      parser.feed(msg.content);
      console.log(parser.results[0]);
    } catch (e) {
      console.log(e);
      msg.channel.send(
        util_functions.desc_embed(
          '```\n' + e.toString().substring(0, 1000) + '```'
        )
      );
    }
    let results = parser.results;
    /*await msg.channel.send(util_functions.desc_embed(
    'Parsed command as:\n```json\n' + JSON.stringify(results[0][0]) + '```'
 ));*/
    for (let module of all_command_modules) {
      for (let registered_command of module.commands)
        try {
          if (registered_command.matcher(results[0][0])) {
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
                let feedback = await msg.channel.awaitMessages(
                  (n) => n.author.id == msg.author.id,
                  { max: 1, time: 20000 }
                );
                Sentry.configureScope(function (scope) {
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
                  let feedback = await msg.channel.awaitMessages(
                    (n) => n.author.id == msg.author.id,
                    { max: 1, time: 30000 }
                  );
                  Sentry.configureScope(function (scope) {
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
          }
        } catch (e) {
          //
        }
    }
  } catch (e) {
    console.error(e);
    Sentry.configureScope(function (scope) {
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
Object.defineProperty(Array.prototype, 'chunk_inefficient', {
  value: function (chunkSize) {
    var array = this;
    return [].concat.apply(
      [],
      array.map(function (elem, i) {
        return i % chunkSize ? [] : [array.slice(i, i + chunkSize)];
      })
    );
  },
});

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
if (process.env.STATUSTRACKER_URL) {
  let reportStatus = async () => {
    try {
      let res = await (
        await fetch(process.env.STATUSTRACKER_URL + '/ping', {
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
  }, process.env.STATUSTRACKER_TIME_MS);
}
if (process.env.PORT) {
  app.listen(process.env.PORT, function () {
    console.log('CORS-enabled web server listening on port 80');
  });
}
