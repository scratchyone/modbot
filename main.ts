/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-var-requires */
import Discord, { Snowflake, TextChannel } from 'discord.js';
import moment from 'moment';
import { Types as ParserTypes } from './parser_types.js';
import Sentry from '@sentry/node';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import SentryTypes from '@sentry/types';
import { Model } from 'objection';
import Knex from 'knex';
import KeyValueStore from './kvs.js';
import * as AutoResponders from './autoresponders.js';
import vm from 'vm';
import { setLogLevel, LogBit } from 'logbit';
setLogLevel(
  ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'].indexOf(
    (process.env.LOG_LEVEL || 'INFO').toUpperCase()
  )
);
const log = new LogBit('Main');
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const adminServerPermissionOverwrites: Array<{
  guild: string;
  timestamp: number;
}> = [];
const store = new KeyValueStore();
// Initialize knex.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const knex = Knex(
  Object.values((await import('./knexfile.cjs')).default)[0] as any
);
// Give the knex instance to objection.
Model.knex(knex);
(await import('dotenv')).config();
import * as Web from './web.js';
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
import parse_duration from 'parse-duration';

import nodefetch from 'node-fetch';
const mutes = await (async () => {
  try {
    return await import('./submodules/mutes.js');
  } catch (e) {
    return undefined;
  }
})();
const alertchannels = await (async () => {
  try {
    return await import('./submodules/alertchannels.js');
  } catch (e) {
    return undefined;
  }
})();
const automod = await (async () => {
  try {
    return await import('./submodules/automod.js');
  } catch (e) {
    return undefined;
  }
})();
import { nanoid } from 'nanoid';
//const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
import * as anonchannels from './anonchannels.js';
import * as util_functions from './util_functions.js';
const client = new Discord.Client({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
  intents: 65407,
});
interface MatcherCommand {
  command: string;
}
import { Prefix } from './types.js';
import * as Types from './types.js';
import parse from 'parse-duration';
const main_commands = {
  title: 'Main Commands',
  description: 'All main bot commands',
  commands: [
    {
      name: 'pin',
      syntax: 'pin <text: string>',
      explanation: 'Allows you to pin something anonymously',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_MESSAGES'),
      responder: async (msg: Discord.Message, cmd: { text: string }) => {
        // Try to delete the message.
        // This can throw an error if the message was already deleted by another bot, so catch that if it does
        try {
          msg.delete();
        } catch (e) {}

        try {
          // Resend the original message through the bot's account, then pin it
          await (await msg.channel.send(cmd.text)).pin();

          // Log what was done
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
      syntax: 'eval <code: string>',
      explanation: 'Run code',
      version: 2,
      permissions: (msg: Discord.Message) =>
        msg.author.id === '234020040830091265' && msg.member,
      responder: async (ctx: Types.Context, cmd: { code: string }) => {
        // This is done to allow accessing discord even in compiled TS where it will be renamed
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        const discord = Discord;
        try {
          // Define a function for cloning users that can be called from inside eval-ed code
          const cloneUser = async (user: string, text: string) => {
            if (ctx.msg.guild !== null) {
              const uuser = ctx.msg.guild.members.cache.get(user as Snowflake);
              if (!uuser) throw new Error('User not found');
              const loghook = await (
                ctx.msg.channel as TextChannel
              ).createWebhook(uuser.displayName, {
                avatar: uuser.user.displayAvatarURL().replace('webp', 'png'),
              });
              await loghook.send(text);
              await loghook.delete();
              await ctx.msg.delete();
            }
          };
          if (!cloneUser) return;
          // Remove markdown code formatting from the input
          let code = cmd.code;
          if (code.startsWith('```js')) code = code.substring(5);
          if (code.startsWith('```javascript')) code = code.substring(13);
          if (code.startsWith('```')) code = code.substring(3);
          if (code.startsWith('`')) code = code.substring(1);
          if (code.endsWith('```')) code = code.slice(0, -3);
          if (code.endsWith('`')) code = code.slice(0, -1);

          let wrappedCode = '';

          // Detect what type of arrow function needs to be used
          try {
            // Try to compile function without braces
            vm.compileFunction(`(async () => ${code})`);
            // If it succeeds, set the final code to be run without braces to remove the need for return statements
            wrappedCode = `(async () => ${code})`;
          } catch (e) {
            // If it fails, set the final code to be run with braces
            wrappedCode = `(async () => {${code}})`;
          }
          log.debug(`Wrapped code: ${wrappedCode}`);
          // Define arrow function with eval
          const func = eval(wrappedCode);
          // Run created arrow function
          let funcResult;
          try {
            funcResult = await func();
          } catch (e) {
            ctx.msg.channel.send(
              util_functions.embed(
                util_functions.truncate(e.toString(), 4096),
                'warning'
              )
            );
            return;
          }
          log.debug(`Function result: ${JSON.stringify(funcResult, null, 2)}`);
          if (funcResult)
            await ctx.msg.channel.send(
              util_functions.embed(
                '```json\n' +
                  util_functions.truncate(
                    JSON.stringify(funcResult, null, 2),
                    4096 - 11
                  ) +
                  '```',
                'success'
              )
            );
          else await ctx.msg.channel.send(util_functions.embed('', 'success'));
        } catch (e) {
          throw new util_functions.BotError('user', e.toString());
        }
      },
    },
    {
      name: 'say',
      syntax: 'say [channel: channel] <keep: "keep" | "remove"> <text: string>',
      explanation: 'Make the bot say something in a channel',
      permissions: (msg: Discord.Message) =>
        (msg.member && msg.member.permissions.has('MANAGE_MESSAGES')) ||
        msg.author.id === '234020040830091265',
      version: 3,
      responder: async (
        ctx: Types.Context,
        cmd: {
          channel?: Discord.TextChannel;
          keep: 'keep' | 'remove';
          text: string;
        }
      ) => {
        // If channel isn't a text channel, we can't send messages there, so throw an error
        if (
          (cmd.channel || ctx.msg.channel).type !== 'GUILD_TEXT' &&
          (cmd.channel || ctx.msg.channel).type !== 'GUILD_PRIVATE_THREAD' &&
          (cmd.channel || ctx.msg.channel).type !== 'GUILD_PUBLIC_THREAD'
        )
          throw new util_functions.BotError(
            'user',
            "Channel isn't a text channel!"
          );

        // If cmd.channel is not populated then the selected channel should be the current one
        const chan = (cmd.channel || ctx.msg.channel) as Discord.TextChannel;

        // This shouldn't be able to happen
        if (!ctx.msg.guild)
          throw new util_functions.BotError('user', 'No guild found');

        // If the user wants their command message to be deleted, make sure the bot has permission to do that
        if (!cmd.keep)
          util_functions.assertHasPerms(ctx.msg.guild, ['MANAGE_MESSAGES']);

        // If the channel they're trying to send messages in is an anonchannel, and they're banned from going anon, throw an error
        if (
          (await prisma.anonchannels.findFirst({
            where: {
              id: cmd.channel ? cmd.channel.id : ctx.msg.channel.id,
              server: ctx.msg.guild.id,
            },
          })) &&
          (await prisma.anonbans.findFirst({
            where: {
              user: ctx.msg.author.id,
              server: ctx.msg.guild.id,
            },
          }))
        ) {
          throw new util_functions.BotError(
            'user',
            `${ctx.msg.author}, you're banned from sending messages there!`
          );
        }

        // If the user doesn't have send message perms in the channel they're trying to send a message in, throw an error
        if (!chan.permissionsFor(ctx.msg.author)?.has('SEND_MESSAGES')) {
          throw new util_functions.BotError(
            'user',
            `${ctx.msg.author}, you can't send messages there!`
          );
        } else {
          // Delete the command message if the user has chosen to remove it
          if (cmd.keep == 'remove')
            try {
              await ctx.msg.delete();
            } catch (e) {}
          // If not, add a reaction to show the command has succeeded
          else await ctx.msg.react('✅');

          // Send the message
          await ((cmd.channel || ctx.msg.channel) as Discord.TextChannel).send(
            cmd.text
          );

          // Log what was done
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
      syntax:
        'setanonchannel <enabled: "enabled" | "disabled"> [channel: channel_id]',
      explanation:
        'Add/Remove an anonymous channel. If no channel is provided it will use the current channel',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_CHANNELS'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { enabled: 'enabled' | 'disabled'; channel?: string }
      ) => {
        if (!msg.guild || !msg.guild.id) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        const channel = cmd.channel ? cmd.channel : msg.channel.id;
        if (cmd.enabled == 'enabled') {
          if (
            await prisma.anonchannels.findFirst({
              where: {
                id: channel,
              },
            })
          )
            throw new util_functions.BotError(
              'user',
              'That anonchannel is already enabled'
            );
          await prisma.anonchannels.create({
            data: {
              id: channel,
              server: (msg.guild as Discord.Guild).id,
            },
          });
        } else {
          await prisma.anonchannels.deleteMany({
            where: {
              id: channel,
              server: (msg.guild as Discord.Guild).id,
            },
          });
        }
        msg.dbReply(
          util_functions.embed(
            `${
              cmd.enabled == 'enabled' ? 'Enabled' : 'Disabled'
            } <#${channel}>${
              cmd.enabled == 'enabled'
                ? '. Start a message with \\ to prevent it from being sent anonymously'
                : ''
            }`,
            'success'
          )
        );
        await Types.LogChannel.tryToLog(
          msg,
          `${
            cmd.enabled == 'enabled' ? 'Enabled' : 'Disabled'
          } anonchannel <#${channel}>`
        );
      },
    },
    {
      name: 'listanonchannels',
      syntax: 'listanonchannels',
      explanation: 'Lists all anonymous channels',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_CHANNELS'),
      responder: async (msg: util_functions.EMessage) => {
        if (!msg.guild || !msg.guild.id) return;
        const channels = await prisma.anonchannels.findMany({
          where: { server: msg.guild.id },
        });
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
      syntax: 'whosaid <id: string>',
      explanation: 'See who sent an anon message',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_MESSAGES'),
      responder: async (msg: util_functions.EMessage, cmd: { id: string }) => {
        if (!msg.guild || !msg.guild.id) return;
        const author = await prisma.anonmessages.findFirst({
          where: { id: cmd.id, server: msg.guild.id },
        });
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
        'reminder/rm/remind/remindme [action: "add"] <duration: duration> <text: string>',
      explanation: 'Set a reminder',
      version: 2,
      permissions: () => true,
      responder: async (
        ctx: Types.Context,
        cmd: { duration: number; text: string }
      ): Promise<Array<() => void> | undefined> => {
        if (!ctx.msg.guild) return;
        const undoStack: Array<() => void> = [];
        let id = nanoid(5);
        if (
          ctx.msg.author.id === '671486892457590846' ||
          ctx.msg.author.id === '991227059089190932'
        ) {
          for (const morb of util_functions.shuffle([
            'M0RB1N-T1M3',
            'MORBIUS',
            'MORB1US',
            'M0RB',
            'M0RBIUS',
            'MR0B',
            'M0RB1US',
            'farting',
            'farting',
            'shitting',
            'pooping',
            'morbiu5',
            'morbius_prime',
            'morbology',
            'morbification-B34M',
            'everyone_stand_back_i_am_beginning_to_morb',
            'morb_mode',
            'morbinization',
            'morbilia',
            'morbiuswaves',
            'moorbius',
            'morbiuuus',
            'homestuck',
            'more_bius',
            'terezi',
            'nakuru',
            'akizuki',
            'cowbell-revolving-orbit',
            'nanami',
            'minion_movie',
            'marvelfan',
            '6_minutes_until_i_morb',
            'love-morbius',
            'ilovemorbius',
            'rachel',
            'lettuce',
            'squeaking_time',
            'morbinya',
            'mousetime',
            'i_am_beginning_to_mouse',
            '69',
            '420',
            'fuck',
            'urinate',
            'morbinimo',
            'morbonimo',
            'morb1ros3',
            'morprius',
            'gmorbintime',
            'morbetology',
            'krkfkdjdjdjirjrnfncjriejsodoejsndnrjenaosjfnrineuehdheisisomcnfirhisjfnrepskcmemsnqosijcnfnfurifhf',
            'M00RB1N-T1M3',
            'fern',
            '&F4RT',
            'F4RT',
            'amongus',
            'amogus',
            '4M0NG',
            '4MONGUS',
            '4M0NGUS',
            '4M0NGU5',
            'AMONGU5',
            'AM0NGUS',
            'AM0NGU5',
            '4MONGU5',
            'amongusingtime',
            'bugchungus',
            '4M0GU5',
            '4MOGUS',
            '4M0GUS',
            'AM0GUS',
            'AM0GU5',
            'AMOGU5',
            '4MOGU5',
            '4MONG-US',
            '4M0NG-US',
            '4M0NG-U5',
            'AMONG-U5',
            'AM0NG-US',
            'AM0NG-U5',
            '4MONG-U5',
            "Accordingtoallknownlawsofaviation,thereisnowaythatabeeshouldbeabletofly.Itswingsaretoosmalltogetitsfatlittlebodyofftheground.Thebee,ofcourse,fliesanywaybecausebeesdon'tcarewhathumansthinkisimpossible.CuttoBarry'sroom,wherehe'spickingoutwhattowear.BarryYellow,black.Yellow,black.Yellow,black.Yellow,black.Ooh,blackandyellow!Yeah,let'sshakeitupalittle.",
            'shutjdjsisjsk',
            'jadsfhjklafhdshiulfadnfangiulfuginlfugilcngiluasguilncaglnucagnucangkacgnCgnacfsuginacsguinaacsyugacgncdfgyncfgniuafcnggancagniucfsaniguafgncdsaiucadsafnuaiscdnifucbdstnoinucfbgnosiadugniufnycgoiuasndcoifugnadsiucfhnosiaudghfnoidusaghnocfugdsanocfiugdoanuicwegoiucfndiougfludsghafinulesdyufhlughincyehwpufinvlughlehnacsfhnashnacshnacshnhnashnfclhunlhewlhuasflhjghlgjfahvnmvcxnjfsglhadsfhwehliouyweuisghjdfjhgnjvcnjdsflhidsafluiywluewfhjadsjsadfhuafdsgknysfgkuynuhewngysdufyiasbkyugihfsnduacgkhweygrdfilnsiuxygahlefudangykhxiefusdnygkjhdfiugkahisugykfhjxanxhudfniuagykwesdf',
            'vriska',
          ])) {
            if (
              (await prisma.reminders.findUnique({ where: { id: morb } })) ==
              null
            ) {
              id = morb;
              break;
            }
          }
        }
        if (cmd.duration > 1000 * 60 * 60 * 24 * 365 * 50)
          throw new util_functions.BotError(
            'user',
            'Cannot set reminders more than 50 years in the future'
          );
        const createdReminder = await prisma.reminders.create({
          data: {
            author: ctx.msg.author.id,
            id,
            text: await util_functions.cleanPings(cmd.text, ctx.msg.guild),
            time: moment().add(cmd.duration, 'ms').unix(),
          },
        });
        await util_functions.schedule_event(
          {
            type: 'reminder',
            text: await util_functions.cleanPings(cmd.text, ctx.msg.guild),
            channel: ctx.msg.channel.id,
            user: ctx.msg.author.id,
            message: ctx.msg.url,
            id,
            uniqueId: createdReminder.uniqueId,
          },
          cmd.duration + 'ms'
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

        return undoStack;
      },
    },
    {
      name: 'reminder',
      syntax: 'reminder/rm cancel <id: string>',
      explanation: 'Cancel a reminder',
      version: 2,
      permissions: () => true,
      responder: async (
        ctx: Types.Context,
        cmd: { id: string }
      ): Promise<Array<() => void> | undefined> => {
        if (!ctx.msg.guild) return;
        const undoStack: Array<() => void> = [];
        const deleted = await Types.Reminder.query()
          .delete()
          .where('author', ctx.msg.author.id)
          .where('id', cmd.id);
        if (deleted === 0)
          throw new util_functions.BotError('user', 'No reminder found');
        await ctx.msg.dbReply(util_functions.embed('Cancelled!', 'success'));
        return undoStack;
      },
    },
    {
      name: 'reminder',
      syntax: 'reminder/rm copy <id: string>',
      explanation: 'Copy a reminder',
      version: 2,
      permissions: () => true,
      responder: async (
        ctx: Types.Context,
        cmd: { id: string }
      ): Promise<Array<() => void> | undefined> => {
        if (!ctx.msg.guild) return;
        const undoStack: Array<() => void> = [];
        const orig = await Types.Reminder.query().where('id', cmd.id);
        if (!orig.length)
          throw new util_functions.BotError('user', 'Reminder not found');
        if (
          (
            await Types.ReminderSubscriber.query()
              .where('user', ctx.msg.author.id)
              .where('id', cmd.id)
          ).length > 0
        )
          throw new util_functions.BotError(
            'user',
            "You can't subscribe to a reminder more than once."
          );
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

        return undoStack;
      },
    },
    {
      name: 'reminder',
      syntax: 'reminder/rm list',
      explanation: 'List all reminders',
      version: 2,
      permissions: () => true,
      responder: async (
        ctx: Types.Context
      ): Promise<Array<() => void> | undefined> => {
        if (!ctx.msg.guild) return;
        const undoStack: Array<() => void> = [];
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
          const fields: { name: string; value: string; inline: boolean }[][] =
            util_functions.chunk(
              reminders
                .filter((n) => n.text)
                .filter((r) => (r.time || 0) > Date.now() / 1000)
                .flatMap((reminder) => {
                  return [
                    { name: 'Text', value: reminder.text || '', inline: true },
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
              await (await ctx.msg.author.createDM()).send({ embeds: [reply] });
          } catch (e) {
            ctx.msg.dbReply(
              'Failed to send DM, do you have DMs enabled for this server?'
            );
          }
        } else if (otherOp === 0) {
          await ctx.msg.dbReply(util_functions.desc_embed('DMing you!'));
          try {
            await (
              await ctx.msg.author.createDM()
            ).send({
              embeds: [
                new Discord.MessageEmbed()
                  .setURL(
                    `${
                      process.env.UI_URL
                    }reminders/${await Web.mintCapabilityToken(
                      ctx.msg.author.id,
                      'reminders'
                    )}`
                  )
                  .setTitle('Click here to manage your reminders'),
              ],
            });
          } catch (e) {
            ctx.msg.dbReply(
              'Failed to send DM, do you have DMs enabled for this server?'
            );
          }
        }
        return undoStack;
      },
    },
    {
      name: 'clonepurge',
      syntax: 'clonepurge',
      explanation: 'Purge a channels entire history',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_CHANNELS'),
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
          if (msg.channel.type !== 'GUILD_TEXT')
            throw new util_functions.BotError('user', 'Not a text channel!');
          await msg.dbReply(util_functions.desc_embed('Running clonepurge'));
          const new_channel = await msg.channel.clone();
          await new_channel.setPosition(msg.channel.position);
          await new_channel.setTopic(msg.channel.topic || '');
          await new_channel.send(util_functions.desc_embed('CLONING PINS'));
          const pins = [...(await msg.channel.messages.fetchPinned()).values()];
          pins.reverse();
          const anonhook = await new_channel.createWebhook('ClonePurgeHook');
          try {
            for (const pin of pins) {
              //console.log(pin);
              const msg_username = pin.member
                ? pin.member.displayName
                : pin.author.username;
              await (
                (await anonhook.send({
                  content: pin.content,
                  embeds: pin.embeds,
                  files: [...pin.attachments.values()].map((n) => n.url),
                  username: msg_username,
                  avatarURL: pin.author.displayAvatarURL(),
                })) as Discord.Message
              ).pin();
            }
            await anonhook.delete();
            if (type === 2) {
              await msg.dbReply(util_functions.desc_embed('Finished.'));
            } else if (type === 1) {
              await msg.dbReply(util_functions.desc_embed('Archiving'));
              let deleted_catergory = msg.guild.channels.cache.find(
                (n) => n.type == 'GUILD_CATEGORY' && n.name == 'archived'
              );
              if (!deleted_catergory) {
                deleted_catergory = await msg.guild.channels.create(
                  'archived',
                  {
                    type: 'GUILD_CATEGORY',
                  }
                );
              }
              await msg.channel.setParent(
                deleted_catergory as Discord.CategoryChannel
              );
              await msg.channel.permissionOverwrites.set([
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
      syntax: 'deletechannel',
      explanation: 'Delete channel',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_CHANNELS'),
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
      syntax:
        'channeluser <allowed: "add" | "remove"> <user: user_id> [channel: channel_id]',
      explanation: 'Add/Remove a user from a channel',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_CHANNELS'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { allowed: string; user: string; channel: string }
      ) => {
        const allowed = cmd.allowed == 'add';
        if (!client.user || !msg.member || !msg.guild)
          throw new util_functions.BotError(
            'user',
            'Something is seriously broken'
          );
        util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
        const channel = client.channels.cache.get(
          (cmd.channel ? cmd.channel : msg.channel.id) as Snowflake
        );
        if (!channel)
          throw new util_functions.BotError('user', 'Channel not found');
        if (channel.type != 'GUILD_TEXT')
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
        const user = msg.guild.members.cache.get(cmd.user as Snowflake);
        if (!user) throw new util_functions.BotError('user', 'User not found');
        if (!allowed) {
          await realchannel.permissionOverwrites.edit(user, {
            VIEW_CHANNEL: false,
            SEND_MESSAGES: false,
          });
        } else {
          await realchannel.permissionOverwrites.edit(user, {
            VIEW_CHANNEL: true,
            SEND_MESSAGES: true,
          });
        }
        await msg.dbReply(
          util_functions.embed(
            `${allowed ? 'Allowed' : 'Disallowed'} ${user} ${
              allowed ? 'to' : 'from'
            } ${
              allowed ? 'read and send' : 'reading and sending'
            } messages in ${channel}`,
            'success'
          )
        );
        await Types.LogChannel.tryToLog(
          msg,
          `${allowed ? 'Allowed' : 'Disallowed'} ${user} ${
            allowed ? 'to' : 'from'
          } ${allowed ? 'read' : 'reading'} messages in ${channel}`
        );
      },
    },
    {
      name: 'archivechannel',
      syntax: 'archivechannel [role: role_id]',
      explanation:
        "Archive a channel. Users with specified role will still be able to see it. If you don't supply a role, it will use your highest role.",
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_CHANNELS'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { role: string }
      ) => {
        if (!msg.guild || !msg.member) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
        const deleted_category = (msg.guild.channels.cache.find(
          (n) => n.type == 'GUILD_CATEGORY' && n.name == 'archived'
        ) ||
          (await msg.guild.channels.create('archived', {
            type: 'GUILD_CATEGORY',
          }))) as Discord.CategoryChannel;

        if (msg.channel.type !== 'GUILD_TEXT')
          throw new util_functions.BotError('user', 'Not a text channel');
        await msg.channel.setParent(deleted_category);
        await msg.channel.permissionOverwrites.set([
          {
            id: msg.guild.id,
            deny: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
          },
          {
            id: (cmd.role || msg.member.roles.highest.id) as Snowflake,
            allow: ['VIEW_CHANNEL'],
          },
        ]);
        await msg.dbReply(
          util_functions.embed(
            `Archived channel for role <@&${
              cmd.role || msg.member.roles.highest.id
            }>!`,
            'success'
          )
        );
        await Types.LogChannel.tryToLog(
          msg,
          `Archived ${msg.channel} for <@&${
            cmd.role || msg.member.roles.highest.id
          }>`
        );
      },
    },
    {
      name: 'anonban',
      syntax: 'anonban <user: user_id> [time: string]',
      explanation: 'Ban a user from going anonymous',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_CHANNELS'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { user: string; time: string }
      ) => {
        if (!msg.guild) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        await prisma.anonbans.create({
          data: {
            user: cmd.user,
            server: msg.guild.id,
          },
        });
        if (cmd.time) {
          await util_functions.schedule_event(
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
      syntax: 'anonunban <user: user_id>',
      explanation: 'Unban a user from going anonymous',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_CHANNELS'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { user: string }
      ) => {
        if (!msg.guild) return;
        await prisma.anonbans.deleteMany({
          where: {
            user: cmd.user,
            server: msg.guild.id,
          },
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
      syntax:
        'tmpchannel <name: word> <duration: word> <public: "private" | "public">',
      explanation: 'Create a temporary channel',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_CHANNELS'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { name: string; duration: string; public: string }
      ) => {
        if (!msg.guild) return;
        const publicc = cmd.public == 'public';

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
            type: 'GUILD_TEXT',
            permissionOverwrites: publicc
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
        await util_functions.schedule_event(
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
      syntax: 'setpinperms <allowed: "allowed" | "disallowed"> <role: role_id>',
      explanation: 'Choose if a role can pin messages with the :pushpin: react',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_ROLES'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { allowed: string; role: string }
      ) => {
        if (!msg.guild) return;
        const allowed = cmd.allowed == 'allowed';
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        if (allowed) {
          if (
            await prisma.pinners.findFirst({
              where: {
                roleid: cmd.role,
                guild: msg.guild.id,
              },
            })
          )
            throw new util_functions.BotError(
              'user',
              'That role is already allowed to pin'
            );
          await prisma.pinners.create({
            data: {
              roleid: cmd.role,
              guild: msg.guild.id,
            },
          });
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
          await prisma.pinners.deleteMany({
            where: {
              roleid: cmd.role,
              guild: msg.guild.id,
            },
          });
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
      syntax: 'listpinperms',
      explanation: 'List all roles with :pushpin: permissions',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_ROLES'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: Record<string, never>
      ) => {
        if (cmd.command !== 'listpinperms' || !msg.guild) return;
        const roles = await prisma.pinners.findMany({
          where: { guild: msg.guild.id },
        });
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
      syntax: 'autoresponder/ar <action: "add" | "remove" | "list">',
      explanation: 'Configure an AutoResponder',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_MESSAGES'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { action: string }
      ) => {
        if (!msg.guild) return;
        if (cmd.action === 'add') {
          try {
            await msg.dbReply({
              embeds: [
                new Discord.MessageEmbed()
                  .setTitle('Tip!')
                  .setColor('#397cd1')
                  .setDescription(
                    'You can define custom variables like `{{NAME}}` that can be used in the AutoResponder reply'
                  ),
              ],
            });
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
            await msg.dbReply({
              embeds: [
                new Discord.MessageEmbed()
                  .setTitle('Tip!')
                  .setColor('#397cd1')
                  .setDescription(
                    '`{{author}}` will be replaced with a mention of the user who triggered the AutoResponder'
                  ),
              ],
            });
            if (message_type === 0) {
              const response = await msg.ask(
                'What should I reply with?',
                50000
              );
              await prisma.autoresponders.create({
                data: {
                  prompt,
                  type: 'text',
                  text_response: response,
                  server: msg.guild.id,
                },
              });
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
              await prisma.autoresponders.create({
                data: {
                  prompt,
                  type: 'embed',
                  embed_title,
                  embed_description: embed_desc,
                  server: msg.guild.id,
                },
              });
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
            log.error(e);
            await msg.dbReply(
              util_functions.desc_embed('Failed to create AutoResponder')
            );
          }
        } else if (cmd.action === 'remove') {
          const prompt = await msg.ask(
            'What AutoResponder would you like to remove?',
            50000
          );
          const rc = await prisma.autoresponders.deleteMany({
            where: {
              prompt,
              server: msg.guild.id,
            },
          });
          if (rc.count) {
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
          const ars = await prisma.autoresponders.findMany({
            where: {
              server: msg.guild.id,
            },
          });
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
      syntax: 'alpha/a <text: string>',
      explanation: 'Query Wolfram Alpha',
      version: 2,
      permissions: () => process.env.WOLFRAMALPHA_KEY,
      responder: async (ctx: Types.Context, cmd: { text: string }) => {
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
            `Sorry, please wait **${+Humanize.toFixed(
              (ctx.store.timeLeft(`rateLimits.alpha.${ctx.msg.author.id}`) ||
                0) / 1000
            )}s** before trying again`
          );
        ctx.msg.channel.sendTyping();
        try {
          const res = (await (
            await nodefetch(
              'http://api.wolframalpha.com/v2/query?appid=' +
                process.env.WOLFRAMALPHA_KEY +
                '&input=' +
                encodeURIComponent(cmd.text) +
                '&format=plaintext&output=json'
            )
          ).json()) as any;
          log.debug("Wolfram Alpha's response:", res);
          ctx.store.set(
            `alpha.${cmd.text}`,
            res.queryresult.pods[1].subpods[0].plaintext
          );
          ctx.msg.dbReply({
            embeds: [
              new Discord.MessageEmbed()
                .setTitle('Result')
                .setDescription(ctx.store.get(`alpha.${cmd.text}`) as string)
                .setAuthor(
                  'Wolfram Alpha',
                  'https://media.discordapp.net/attachments/745460367173484624/765623618297790464/wolfram-alpha-2-569293.png',
                  'https://www.wolframalpha.com/'
                )
                .setColor('#4269cc'),
            ],
          });
        } catch (e) {
          ctx.msg.dbReply({
            embeds: [
              new Discord.MessageEmbed()
                .setAuthor(
                  'Wolfram Alpha',
                  'https://media.discordapp.net/attachments/745460367173484624/765623618297790464/wolfram-alpha-2-569293.png',
                  'https://www.wolframalpha.com/'
                )
                .setTitle('No Result')
                .setDescription("Wolfram Alpha didn't have an answer for that")
                .setColor('#cc4d42'),
            ],
          });
          log.error("Couldn't get Wolfram Alpha result", e);
        }
      },
    },
    {
      name: 'support',
      syntax: 'support',
      explanation: 'Get an invite to the support server',
      permissions: () => true,
      responder: async (msg: util_functions.EMessage) => {
        msg.dbReply({
          embeds: [
            new Discord.MessageEmbed()
              .setURL('https://discord.gg/wJ2TCpx')
              .setTitle('Click here to join the support server')
              .setColor(util_functions.COLORS.decorate),
          ],
        });
      },
    },
    {
      name: 'joinroles',
      syntax: 'joinroles <action: "enable" | "disable">',
      explanation: 'Configure roles given automatically to users who join',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_ROLES'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { action: string }
      ) => {
        if (!msg.guild || !msg.member) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
        if (cmd.action === 'enable') {
          if (
            await prisma.join_roles.findFirst({
              where: { server: msg.guild.id },
            })
          ) {
            throw new util_functions.BotError(
              'user',
              'This server already has a join role. You can disable it with `m: joinroles disable`'
            );
          }
          await msg.dbReply(
            'What role would you like to set as the join role?'
          );
          const role = await msg.channel.awaitMessages({
            max: 1,
            time: 20000,
            filter: (m) => m.author.id == msg.author.id,
          });
          if (![...role.values()].length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          const rrole = [...role.values()][0].content
            .replace('<@&', '')
            .replace('>', '');
          const disc_role = msg.guild.roles.cache.get(rrole as Snowflake);
          if (!disc_role) {
            await msg.dbReply("Role doesn't exist!");
            return;
          }
          if (disc_role.position >= msg.member.roles.highest.position)
            throw new util_functions.BotError(
              'user',
              'That role is above or equal to your current highest role'
            );
          await prisma.join_roles.create({
            data: {
              server: msg.guild.id,
              role: rrole,
            },
          });
          await msg.dbReply(util_functions.desc_embed('Setup!'));
          await Types.LogChannel.tryToLog(msg, 'Added JoinRole');
        } else if (cmd.action === 'disable') {
          if (
            !(await prisma.join_roles.findFirst({
              where: { server: msg.guild.id },
            }))
          ) {
            throw new util_functions.BotError(
              'user',
              "This server doesn't have a join role."
            );
          }
          await prisma.join_roles.deleteMany({
            where: { server: msg.guild.id },
          });
          await msg.dbReply(util_functions.desc_embed('Disabled!'));
          await Types.LogChannel.tryToLog(msg, 'Removed JoinRole');
        }
      },
    },
    {
      name: 'reactionroles',
      syntax: 'reactionroles/rr <action: "add" | "edit">',
      explanation: 'Configure reaction roles',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_ROLES'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { action: string }
      ) => {
        if (!msg.guild || !msg.member) return;
        util_functions.assertHasPerms(msg.guild, [
          'MANAGE_ROLES',
          'MANAGE_MESSAGES',
        ]);
        if (cmd.action === 'add') {
          await msg.dbReply(
            'What channel would you like the message to be in?'
          );

          const chan = await msg.channel.awaitMessages({
            max: 1,
            time: 40000,
            filter: (m) => m.author.id == msg.author.id,
          });
          if (![...chan.values()].length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          const cchan = [...chan.values()][0].content
            .replace('<#', '')
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
          const embed_description = await msg.channel.awaitMessages({
            max: 1,
            time: 90000,
            filter: (m) => m.author.id == msg.author.id,
          });
          if (![...embed_description.values()].length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          await msg.dbReply(
            'What should the reactions be?\nFormat:\n```:grinning: @happy\n:sad: @unhappy```'
          );
          const reacts = await msg.channel.awaitMessages({
            max: 1,
            time: 90000,
            filter: (m) => m.author.id == msg.author.id,
          });
          if (![...reacts.values()].length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          let rr_mes;
          try {
            const tmp_chan = msg.guild.channels.cache.get(cchan as Snowflake);
            if (!tmp_chan || tmp_chan.type !== 'GUILD_TEXT') {
              await msg.dbReply(
                util_functions.desc_embed("Channel doesn't exist!")
              );
              return;
            }
            rr_mes = await (tmp_chan as Discord.TextChannel).send({
              embeds: [
                new Discord.MessageEmbed()
                  .setTitle(embed_title || '')
                  .setDescription([...embed_description.values()][0].content),
              ],
            });
          } catch (e) {
            await msg.dbReply(
              util_functions.desc_embed("Couldn't send message!")
            );
            return;
          }
          const hp = msg.member.roles.highest.position;
          const reacts_formatted = [...reacts.values()][0].content
            .split('\n')
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
            const serv_role = msg.guild.roles.cache.get(
              react.role as Snowflake
            );
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
              await prisma.reactionroles.create({
                data: {
                  message: rr_mes.id,
                  server: msg.guild.id,
                  role: react.role,
                  emoji: react.emoji,
                  removable: removable !== 1 ? 1 : 0,
                },
              });
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
              await prisma.reactionroles.create({
                data: {
                  message: rr_mes.id,
                  server: msg.guild.id,
                  role: react.role,
                  emoji: em.id,
                  removable: removable !== 1 ? 1 : 0,
                },
              });
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
          const chan = await msg.channel.awaitMessages({
            max: 1,
            time: 20000,
            filter: (m) => m.author.id == msg.author.id,
          });
          if (![...chan.values()].length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          const cchan = [...chan.values()][0].content
            .replace('<#', '')
            .replace('>', '');
          if (!cchan)
            throw new util_functions.BotError('user', 'No channel found');
          const real_chan = msg.guild.channels.cache.get(cchan as Snowflake);
          if (!real_chan || real_chan.type !== 'GUILD_TEXT')
            throw new util_functions.BotError('user', 'No channel found');
          await msg.dbReply('What is the message ID?');
          const mid = await msg.channel.awaitMessages({
            max: 1,
            time: 20000,
            filter: (m) => m.author.id == msg.author.id,
          });
          if (![...mid.values()].length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          let rr_mes;
          try {
            rr_mes = await (real_chan as Discord.TextChannel).messages.fetch(
              [...mid.values()][0].content as Snowflake
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
          const embed_description = await msg.channel.awaitMessages({
            max: 1,
            time: 70000,
            filter: (m) => m.author.id == msg.author.id,
          });
          if (![...embed_description.values()].length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          await rr_mes.edit({
            embeds: [
              new Discord.MessageEmbed()
                .setTitle(embed_title || '')
                .setDescription([...embed_description.values()][0].content),
            ],
          });
          await msg.dbReply(
            'What should the reactions be?\nFormat:\n```:grinning: @happy\n:sad: @unhappy```'
          );
          const reacts = await msg.channel.awaitMessages({
            max: 1,
            time: 70000,
            filter: (m) => m.author.id == msg.author.id,
          });
          if (![...reacts.values()].length) {
            await msg.dbReply(util_functions.desc_embed('Timed out'));
            return;
          }
          const hp = msg.member.roles.highest.position;
          const reacts_formatted = [...reacts.values()][0].content
            .split('\n')
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
            const serv_role = msg.guild.roles.cache.get(
              react.role as Snowflake
            );
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
          await prisma.reactionroles.deleteMany({
            where: { message: rr_mes.id },
          });
          for (const react of reacts_formatted) {
            if (!react.emoji.includes('<')) {
              await rr_mes.react(react.emoji);
              await prisma.reactionroles.create({
                data: {
                  message: rr_mes.id,
                  server: msg.guild.id,
                  role: react.role,
                  emoji: react.emoji,
                  removable: removable !== 1 ? 1 : 0,
                },
              });
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
              await prisma.reactionroles.create({
                data: {
                  message: rr_mes.id,
                  server: msg.guild.id,
                  role: react.role,
                  emoji: em.id,
                  removable: removable !== 1 ? 1 : 0,
                },
              });
              await rr_mes.react(em.id);
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
      syntax: 'kick <user: user_id>',
      explanation: 'Kick a user',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('KICK_MEMBERS'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { user: string }
      ) => {
        if (!msg.member || !msg.guild) return;
        util_functions.assertHasPerms(msg.guild, ['KICK_MEMBERS']);
        const hp = msg.member.roles.highest.position;
        const kickee = msg.guild.members.cache.get(cmd.user as Snowflake);
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
      syntax: 'ban <user: user_id>',
      explanation: 'Ban a user',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('BAN_MEMBERS'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { user: string }
      ) => {
        if (!msg.member || !msg.guild) return;
        util_functions.assertHasPerms(msg.guild, ['BAN_MEMBERS']);
        const hp = msg.member.roles.highest.position;
        const kickeem = msg.guild.members.cache.get(cmd.user as Snowflake);
        let kickee;
        if (kickeem) {
          const kickee_hp = kickeem.roles.highest.position;
          if (kickee_hp >= hp) {
            throw new util_functions.BotError(
              'user',
              'Your highest role is below or equal to the user you are trying to ban'
            );
          }
          kickee = kickeem.user;
        } else {
          try {
            kickee = await client.users.fetch(cmd.user as Snowflake);
          } catch {
            throw new util_functions.BotError('user', 'User not found');
          }
        }
        const conf = await util_functions.confirm(msg);
        if (conf) {
          if (kickee.id !== client.user?.id) {
            await msg.guild.members.ban(kickee, {
              reason: `Banned by @${msg.author.tag}`,
            });
            await Types.LogChannel.tryToLog(msg, `Banned ${kickee}`);
            await msg.dbReply(util_functions.desc_embed('Banned'));
          } else {
            await Types.LogChannel.tryToLog(msg, `Banned ${kickee}`);
            await msg.dbReply(util_functions.desc_embed('Banned'));
            await msg.guild.leave();
          }
        }
      },
    },
    {
      name: 'tmprole',
      syntax:
        'tmprole <action: "add" | "remove"> <role: role_id> <user: user_id> <duration: string>',
      explanation: "Temporarily change a user's role",
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_ROLES'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { action: string; user: string; role: string; duration: string }
      ) => {
        if (!msg.member || !msg.guild) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
        const hp = msg.member.roles.highest.position;
        const kickee = msg.guild.members.cache.get(cmd.user as Snowflake);
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
            if (!kickee.roles.cache.get(cmd.role as Snowflake)) {
              throw new util_functions.BotError(
                'user',
                `${kickee} doesn't have <@&${cmd.role}>`
              );
            }
            await kickee.roles.remove(cmd.role as Snowflake);
            await util_functions.schedule_event(
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
            const role_to_be_added = msg.guild.roles.cache.get(
              cmd.role as Snowflake
            );
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
            await kickee.roles.add(cmd.role as Snowflake);
            await util_functions.schedule_event(
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
      syntax: 'purge <count: string>',
      explanation: 'Purge messages',
      permissions: (msg: Discord.Message) =>
        msg.member &&
        (msg.channel.type == 'GUILD_TEXT' ||
          msg.channel.type == 'GUILD_PRIVATE_THREAD' ||
          msg.channel.type == 'GUILD_PUBLIC_THREAD'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { count: string }
      ) => {
        if (!msg.guild || !msg.member) return;
        util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
        const count = parseInt(cmd.count);
        if (
          (msg.channel as Discord.TextChannel)
            .permissionsFor(msg.member)
            ?.has('MANAGE_MESSAGES')
        ) {
          if (count > 100) {
            throw new util_functions.BotError(
              'user',
              'Must be less than or equal to 100 messages'
            );
          }
          if (count > 50) {
            if (!(await util_functions.confirm(msg)))
              throw new util_functions.BotError(
                'user',
                'Confirmation needed to delete more than 50 messages'
              );
          }
          try {
            const purged_msg_num = await (
              msg.channel as Discord.TextChannel
            ).bulkDelete(count + 1);
            const purged_info_msg = await msg.channel.send(
              `Purged ${[...purged_msg_num.values()].length - 1} messages`
            );
            setTimeout(() => {
              purged_info_msg.delete();
            }, 2000);
            await Types.LogChannel.tryToLog(
              msg,
              `Purged ${count} message${count === 1 ? '' : 's'} in ${
                msg.channel
              }`
            );
          } catch (e) {
            throw new util_functions.BotError('user', (e as any).toString());
          }
        } else {
          if (count > 20) {
            throw new util_functions.BotError(
              'user',
              'Must be less than or equal to 20 messages'
            );
          }
          const warningMessage = await msg.dbReply(
            util_functions.embed(
              `Deleting the last ${count} messages from <@${msg.member.id}>`,
              'warning'
            )
          );

          try {
            const messagesToBePurged = (
              await msg.channel.messages.fetch({
                limit: 100,
              })
            )
              .filter((m) => m.author.id === msg.author.id)
              .first(count + 1);
            // Delete all messages in messagesToBePurged
            const purged_msg_num = await (
              msg.channel as Discord.TextChannel
            ).bulkDelete(messagesToBePurged);
            const purged_info_msg = await msg.channel.send(
              `Deleted ${[...purged_msg_num.values()].length - 1} messages`
            );
            setTimeout(() => {
              purged_info_msg.delete();
              warningMessage.delete();
            }, 2000);
          } catch (e) {
            throw new util_functions.BotError('user', (e as any).toString());
          }
        }
      },
    },
    {
      name: 'usercard',
      syntax: 'usercard <user: user_id>',
      explanation: "Get a user's information card",
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_MESSAGES'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { user: string }
      ) => {
        if (!msg.guild) return;
        const mentioned_member = msg.guild.members.cache.get(
          cmd.user as Snowflake
        );
        let mentioned_user;
        try {
          mentioned_user = await client.users.fetch(cmd.user as Snowflake);
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
          ? await prisma.mute_roles.findFirst({
              where: { server: msg.guild.id },
            })
          : undefined;
        const desc: Array<string> = [];
        let use_pronouns = false;
        if (mute_role && mentioned_member) {
          if (mentioned_member.roles.cache.get(mute_role.role as Snowflake)) {
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
        const usernotes = (
          await prisma.notes.findMany({
            where: {
              user: mentioned_member?.id || cmd.user,
              server: msg.guild.id,
              type: 'note',
            },
          })
        ).map((n) => n.message);
        const userwarns = (
          await prisma.notes.findMany({
            where: {
              user: mentioned_member?.id || cmd.user,
              server: msg.guild.id,
              type: 'warn',
            },
          })
        ).map((n) => n.message);
        msg.dbReply({
          embeds: [
            new Discord.MessageEmbed()
              .setAuthor(mm_nick, mentioned_user.displayAvatarURL())
              .setDescription(desc.join(' '))
              .setColor(util_functions.COLORS.decorate)
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
              ]),
          ],
        });
      },
    },
    {
      name: 'note',
      syntax: 'note <user: user_id> <text: string>',
      explanation: 'Add a note to a user',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_MESSAGES'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { user: string; text: string }
      ) => {
        if (!msg.guild) return;
        const id = nanoid(5);
        await prisma.notes.create({
          data: {
            type: 'note',
            message: cmd.text,
            user: cmd.user,
            server: msg.guild.id,
            id,
          },
        });
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
      syntax: 'warn <user: user_id> <text: string>',
      explanation: 'Add a warn to a user',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_MESSAGES'),
      responder: async (
        msg: util_functions.EMessage,
        cmd: { user: string; text: string }
      ) => {
        if (!msg.guild) return;
        const id = nanoid(5);
        await prisma.notes.create({
          data: {
            type: 'warn',
            message: cmd.text,
            user: cmd.user,
            server: msg.guild.id,
            id,
          },
        });
        const mentioned_member = msg.guild.members.cache.get(
          cmd.user as Snowflake
        );
        if (!mentioned_member)
          throw new util_functions.BotError(
            'user',
            "Can't find user! Have they left the server?"
          );
        try {
          await (
            await mentioned_member.createDM()
          ).send({
            embeds: [
              new Discord.MessageEmbed()
                .setTitle(`You have been warned in ${msg.guild.name}`)
                .setDescription(`**Warn Message:**\n> ${cmd.text}`)
                .setFooter(`Warning ID: ${id}`)
                .setColor(util_functions.COLORS.error),
            ],
          });
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
      syntax: 'forgive <id: string>',
      explanation: 'Remove a warn/note',
      permissions: (msg: Discord.Message) =>
        msg.member && msg.member.permissions.has('MANAGE_MESSAGES'),
      responder: async (msg: util_functions.EMessage, cmd: { id: string }) => {
        if (!msg.guild) return;
        const warn_item = await prisma.notes.findFirst({
          where: {
            server: msg.guild.id,
            id: cmd.id,
          },
        });
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
        await prisma.notes.deleteMany({
          where: {
            server: msg.guild.id,
            id: cmd.id,
          },
        });
        await msg.dbReply(util_functions.desc_embed(`Removed ${cmd.id}`));
        await Types.LogChannel.tryToLog(msg, `Removed warn/note \`${cmd.id}\``);
      },
    },
    {
      name: 'help',
      syntax: 'help [topic: string]',
      explanation: 'View a help menu',
      version: 2,
      permissions: () => true,
      responder: async (
        ctx: Types.Context,
        cmd: { topic: string | undefined }
      ) => {
        if (typeof cmd.topic === 'string') {
          const chosen_module = all_command_modules.find(
            (mod) => mod.title.toLowerCase() == cmd.topic?.toLowerCase()
          );
          if (!chosen_module) {
            const valid_commands = [];
            for (const module of all_command_modules) {
              for (const registered_command of module.commands)
                try {
                  if (
                    registered_command.name.toLowerCase() ==
                    cmd.topic.toLowerCase()
                  ) {
                    valid_commands.push(registered_command);
                  }
                } catch (e) {}
            }
            if (valid_commands.length === 0) {
              // Try another method
              for (const module of all_command_modules) {
                for (const registered_command of module.commands)
                  try {
                    const grammar = (
                      registered_command.grammar as ParsedCommandDef
                    )[0];
                    if (
                      grammar.type == 'string_literal' &&
                      grammar.values
                        .map((n) => n.toLowerCase())
                        .includes(cmd.topic.toLowerCase())
                    ) {
                      valid_commands.push(registered_command);
                    }
                  } catch (e) {}
              }
            }
            if (valid_commands.length) {
              ctx.msg.dbReply({
                embeds: [
                  new Discord.MessageEmbed()
                    .setTitle(
                      util_functions.fillStringVars('Help for __botName__')
                    )
                    .setColor(util_functions.COLORS.decorate)
                    .setDescription(
                      '*<> means required, [] means optional.*\n' +
                        valid_commands
                          .map(
                            (registered_command) =>
                              '**' +
                              Humanize.capitalize(registered_command.name) +
                              '\n**' +
                              (registered_command.explanation ||
                                registered_command.long_explanation) +
                              '\n**Syntax**\n' +
                              `\`${
                                ctx.prefix +
                                generateCommandString(
                                  registered_command.grammar
                                )
                              }\``
                          )
                          .join('\n\n')
                    ),
                ],
              });
              return;
            }
            throw new util_functions.BotError(
              'user',
              'Module/Command not found!'
            );
          }
          ctx.msg.dbReply({
            embeds: [
              new Discord.MessageEmbed()
                .setTitle(util_functions.fillStringVars('Help for __botName__'))
                .setColor(util_functions.COLORS.decorate)
                .setDescription(
                  '**' +
                    chosen_module.title +
                    '**\n' +
                    chosen_module.description +
                    '\n*<> means required, [] means optional.*\nType ' +
                    ctx.prefix +
                    'help <NAME> to get help for a specific command'
                )
                .addFields(
                  chosen_module.commands
                    .filter(
                      // eslint-disable-next-line no-unused-vars
                      (command: {
                        permissions: (arg0: Discord.Message) => boolean;
                      }) =>
                        command.permissions(ctx.msg) ||
                        adminServerPermissionOverwrites.find(
                          (p) =>
                            p.timestamp > Date.now() / 1000 &&
                            p.guild === ctx.msg.guild?.id &&
                            ctx.msg.author.id === '234020040830091265'
                        )
                    )
                    .map(
                      (n: {
                        name: string;
                        grammar: ParsedCommandDef;
                        explanation: string;
                      }) => {
                        return {
                          name: Humanize.capitalize(n.name),
                          value: `\`${
                            ctx.prefix + generateCommandString(n.grammar)
                          }\`\n${n.explanation}`,
                          inline: false,
                        };
                      }
                    )
                ),
            ],
          });
        } else {
          const chunks = all_command_modules
            .map((mod) => {
              const cmds = mod.commands
                .filter(
                  // eslint-disable-next-line no-unused-vars
                  (command: {
                    permissions: (arg0: Discord.Message) => boolean;
                  }) =>
                    command.permissions(ctx.msg) ||
                    adminServerPermissionOverwrites.find(
                      (p) =>
                        p.timestamp > Date.now() / 1000 &&
                        p.guild === ctx.msg.guild?.id &&
                        ctx.msg.author.id === '234020040830091265'
                    )
                )
                .map(
                  (cmd: { grammar: ParsedCommandDef }) =>
                    `\`${ctx.prefix + generateCommandString(cmd.grammar)}\``
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
          ctx.msg.dbReply({
            embeds: [
              new Discord.MessageEmbed()
                .setTitle(util_functions.fillStringVars('Help for __botName__'))
                .setColor(util_functions.COLORS.decorate)
                .setDescription(
                  '<> means required, [] means optional. Type `' +
                    ctx.prefix +
                    'help <NAME>` to get help for a specific command module or command'
                )
                .addFields(chunks),
            ],
          });
        }
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
    embeds: [
      new Discord.MessageEmbed()
        .setTitle('New Reminder!')
        .setDescription(
          text + (message ? '\n\n[Jump to message](' + message + ')' : '')
        )
        .setAuthor(
          origAuthor ? origAuthor.displayName : '',
          origAuthor?.user.displayAvatarURL()
        )
        .setColor('#3e8ac5'),
    ],
  };
}
client.on('ready', async () => {
  if (!client.user) {
    log.error('No client user!');
    return;
  }
  log.info(`Logged in as ${client.user.tag}!`);
  processDeferredOnStart(client);
  //
  //
  const sp = () => {
    if (!client.user) return;
    client.user.setPresence({
      activities: [
        {
          name: `${process.env.BOT_PREFIX || 'm: '}help | in ${
            client.guilds.cache.size
          } servers with ${client.users.cache.size} users`,
          type: 'PLAYING',
          url: 'https://github.com/scratchyone/modbot',
        },
      ],
    });
  };
  sp();
  setInterval(sp, 1000 * 60 * 60);

  // This will (very) slowly consume more and more memory without ever releasing it.
  // TODO: Make this a rolling log.
  const already_delivered_reminders: string[] = [];
  setInterval(async () => {
    const ts = Math.round(Date.now() / 1000);
    const events = await prisma.timerevents.findMany({
      where: {
        timestamp: {
          lte: ts,
        },
      },
    });
    for (const event_item of events) {
      const event = JSON.parse(event_item.event);
      if (event.type == 'reminder') {
        try {
          // This is a weird hack.
          // It should not be possible for reminders to be delivered more than once.
          // But somehow they rarely are. I have no clue why.
          // My hope is this should stop it.
          // This keeps a log of all delivered reminders by their ID, and then cancels the delivery if a reminder has already been delivered.
          try {
            if (
              already_delivered_reminders.includes(event.uniqueId) &&
              event.uniqueId
            )
              continue;
            already_delivered_reminders.push(event.uniqueId);
          } catch (e) {
            // Some reminders won't have a uniqueId if they were created before 2022-08-22
          }

          const res = await Types.Reminder.query()
            .where('author', event.user)
            .where('id', event.id);
          const subs = await Types.ReminderSubscriber.query().where(
            'id',
            event.id
          );
          if (res.length) {
            const c = client.channels.cache.get(
              event.channel
            ) as Discord.TextChannel;
            if (c) {
              const origAuthor = c.guild.members.cache.get(event.user) || null;
              await c.send(
                reminderEmbed(event.user, origAuthor, event.text, event.message)
              );
              if (subs.length) {
                await (
                  client.channels.cache.get(
                    event.channel
                  ) as Discord.TextChannel
                ).send(subs.map((sub) => `<@${sub.user}> `).join(''));
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
                  log.error(e);
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
          await prisma.anonbans.deleteMany({
            where: {
              user: event.user,
              server: event.server,
            },
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
          channel.permissionOverwrites.edit(event.user, {
            SEND_MESSAGES: true,
          });
          await prisma.slowmoded_users.deleteMany({
            where: {
              user: event.user,
              channel: event.channel,
            },
          });
        } catch (e) {
          log.error(e);
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
          log.error(e);
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
          log.error(e);
        }
      }
      if (event.type == 'unlockdown') {
        try {
          const channel = client.channels.cache.get(
            event.channel
          ) as Discord.TextChannel;
          const perm = await prisma.locked_channels.findFirst({
            where: { channel: channel.id },
          });
          await channel.permissionOverwrites.set(
            JSON.parse(perm?.permissions || '{}')
          );
          await channel.send('Unlocked!');
          await prisma.locked_channels.deleteMany({
            where: {
              channel: channel.id,
            },
          });
          await Types.LogChannel.tryToLog(
            channel.guild,
            `Unlocked ${channel}`,
            'event'
          );
        } catch (e) {
          log.error(e);
        }
      }
    }
    await prisma.timerevents.deleteMany({
      where: {
        timestamp: {
          lte: ts,
        },
      },
    });
  }, 5000);
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
        log.error('Something went wrong when fetching the message: ', error);
        // Return as `reaction.message.author` may be undefined/null
        return;
      }
    }
    if (!reaction.message.guild) return;
    const member = reaction.message.guild.members.cache.get(user.id);
    const roles_that_can_pin = await prisma.pinners.findMany();
    if (
      member &&
      member.roles.cache.find(
        (n) =>
          roles_that_can_pin.filter(
            (rcp) =>
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
          await reaction.message.channel.awaitMessages({
            max: 1,
            time: 1000,
            filter: (n: Discord.Message) => n.system,
          })
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
    let rr = await prisma.reactionroles.findFirst({
      where: {
        emoji: reaction.emoji.name || undefined,
        message: reaction.message.id,
        server: reaction.message.guild.id,
      },
    });
    if (!rr)
      rr = await prisma.reactionroles.findFirst({
        where: {
          emoji: reaction.emoji.id || '',
          message: reaction.message.id,
          server: reaction.message.guild.id,
        },
      });
    if (!user.bot && rr) {
      const member = reaction.message.guild.members.cache.get(user.id);
      try {
        if (member) await member.roles.add(rr.role as Snowflake);
      } catch (e) {
        if (
          await prisma.alert_channels.findFirst({
            where: {
              server: reaction.message.guild.id,
            },
          })
        ) {
          const tmp = reaction.message.guild.channels.cache.get(
            ((
              await prisma.alert_channels.findFirst({
                where: {
                  server: reaction.message.guild.id,
                },
              })
            )?.channel || '') as Snowflake
          );
          if (tmp && tmp.type == 'GUILD_TEXT')
            (tmp as Discord.TextChannel).send(
              util_functions.desc_embed(
                `Warning: Failed to give <@&${rr.role}> to ${user} on reaction role`
              )
            );
        }
      }
    } else if (
      !user.bot &&
      (await prisma.reactionroles.findFirst({
        where: {
          message: reaction.message.id,
          server: reaction.message.guild.id,
        },
      }))
    ) {
      await reaction.remove();
    }
  } catch (e) {
    log.error(e);
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
    if (channel instanceof Discord.TextChannel) {
      await mutes?.onChannelCreate(channel);
    }
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
        log.error('Something went wrong when fetching the message: ', error);
        // Return as `reaction.message.author` may be undefined/null
        return;
      }
    }
    const member = reaction.message.guild.members.cache.get(user.id);
    const roles_that_can_pin = await prisma.pinners.findMany();
    if (
      member &&
      member.roles.cache.find(
        (n) =>
          roles_that_can_pin.filter(
            (rcp) =>
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
      (await prisma.reactionroles.findFirst({
        where: {
          emoji: reaction.emoji.name || undefined,
          message: reaction.message.id,
          server: reaction.message.guild.id,
        },
      })) ||
      (await prisma.reactionroles.findFirst({
        where: {
          emoji: reaction.emoji.id || '',
          message: reaction.message.id,
          server: reaction.message.guild.id,
        },
      }));
    if (!user.bot && rr && rr.removable) {
      const member = reaction.message.guild.members.cache.get(user.id);
      try {
        if (member) await member.roles.remove(rr.role as Snowflake);
      } catch (e) {
        if (
          await prisma.alert_channels.findFirst({
            where: {
              server: reaction.message.guild.id,
            },
          })
        ) {
          const tmp = reaction.message.guild.channels.cache.get(
            ((
              await prisma.alert_channels.findFirst({
                where: {
                  server: reaction.message.guild.id,
                },
              })
            )?.channel || '') as Snowflake
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
import {
  generateCommandString,
  matchCommand,
  parseCommandGrammar,
  ParsedCommandDef,
  ParseError,
} from '@scratchyone/command_parser';
import fs from 'fs';
let all_command_modules = [
  main_commands,
  ...(await Promise.all(
    fs
      .readdirSync(__dirname + '/submodules')
      .map(
        async (mod) =>
          (
            await import(__dirname + '/submodules/' + mod)
          ).commandModule
      )
  )),
];
all_command_modules = all_command_modules.map((module) => {
  const c = module.commands;
  delete module['commands'];
  return {
    commands: c
      .map((command: { syntax: string; name: string }) => {
        try {
          return { grammar: parseCommandGrammar(command.syntax), ...command };
        } catch (e) {
          console.error(command.name + ' ' + e);
          return undefined;
        }
      })
      .filter((n: any) => !!n),
    ...module,
  };
});
for (const module of all_command_modules) {
  if (module.cog) module.cog(client);
}
client.on('guildMemberAdd', async (member) => {
  if (await prisma.join_roles.findFirst({ where: { server: member.guild.id } }))
    member.roles.add(
      ((
        await prisma.join_roles.findFirst({
          where: { server: member.guild.id },
        })
      )?.role || '') as Snowflake
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
      !(await prisma.anonchannels.findFirst({
        where: { id: msg.channel.id },
      })) &&
      msg.author?.id !== '757021641040724070' // Not overseeer
    ) {
      try {
        for (const m of bm) {
          log.info('Deleting message', m);
          await (
            await msg.channel.messages.fetch(m.botMessage as Snowflake)
          ).delete();
        }
      } catch (e) {
        console.error(e);
      }
    }
  }
);

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
  const guildArs = await prisma.autoresponders.findMany({
    where: {
      server: msg.guild.id,
    },
  });
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
            await arTextFill(
              ar.text_response ||
                'FAILED TO PROCESS AUTORESPONDER, SOMETHING IS VERY WRONG',
              msg,
              variables
            ),
            msg.guild
          )
        );
      else if (ar.type == 'embed')
        message.dbReply({
          embeds: [
            new Discord.MessageEmbed()
              .setTitle(ar.embed_title || '')
              .setDescription(
                await arTextFill(
                  ar.embed_description ||
                    'FAILED TO PROCESS AUTORESPONDER, SOMETHING IS VERY WRONG',
                  msg,
                  variables
                )
              ),
          ],
        });
    }
  }
}
async function getPrefix(msg: Discord.Message): Promise<string | null> {
  if (!msg.guild) return null;
  const prefixes = await Prefix.query().where('server', msg.guild.id);
  prefixes.push(
    Prefix.newPrefix(msg.guild.id, process.env.BOT_PREFIX || 'm: ')
  );
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
  const reactions = await confMsg.awaitReactions({
    max: 1,
    time: 60000,
    filter: (reaction: Discord.MessageReaction, user: Discord.User) =>
      !!reaction.message.guild?.members.cache
        .get(user.id)
        ?.permissions.has('ADMINISTRATOR') && reaction.emoji.name === '✅',
  });
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
    msg.member?.permissions.has('MANAGE_CHANNELS') &&
    !(await prisma.alert_channels.findFirst({
      where: {
        server: msg.guild.id,
      },
    })) &&
    !(await prisma.alert_channels_ignore.findFirst({
      where: {
        server: msg.guild.id,
      },
    })) &&
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
async function showSyntaxError(
  msg: Discord.Message,
  registered_commands: {
    grammar: ParsedCommandDef;
    long_explanation: string;
    explanation: string;
    message: string;
  }[],
  matchingPrefix: string
): Promise<void> {
  const message = msg as util_functions.EMessage;
  try {
    await message.dbReply({
      embeds: [
        new Discord.MessageEmbed()
          .setTitle('Syntax Error')
          .setColor(util_functions.COLORS.error)
          .setDescription(
            `${registered_commands
              .map(
                (registered_command) =>
                  `**Help:**\n\`${
                    matchingPrefix +
                    generateCommandString(registered_command.grammar)
                  }\`\n${
                    registered_command.long_explanation ||
                    registered_command.explanation
                  }\n**Message:**\n${registered_command.message}`
              )
              .join('\n\n')}`
          ),
      ],
    });
  } catch (e) {}
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
import Humanize from 'humanize-plus';
import { Defer, processDeferredOnStart } from './defer.js';
import { validateLocaleAndSetLanguage } from 'typescript';
client.on('messageCreate', async (msg: Discord.Message) => {
  // Force msg to EMessage because it *always* will be an EMessage
  const message = msg as util_functions.EMessage;
  try {
    if (!msg.guild) {
      if (msg.content.startsWith(process.env.BOT_PREFIX || 'm: '))
        msg.channel.send('Sorry, commands cannot be used in DMs');
      return;
    }
    if (!client.user) return;
    // In a guild and logged in
    addReactOnMention(msg);
    if (msg.author.id === client.user.id) return;
    // Message author is not ModBot
    if (automod) automod.checkForTriggers(msg as util_functions.EMessage);
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
    /*const parser = new nearley.Parser(nearley.Grammar.fromCompiled(commands));

    try {
      parser.feed(msg.content.replace(matchingPrefix, ''));
    } catch (e) {
      await showSyntaxError(msg, msg.content, matchingPrefix);
    }
    const results = parser.results;*/
    const possibleMatches = [];
    let matched_any = false;
    for (const module of all_command_modules) {
      for (const registered_command of module.commands)
        try {
          let parseRes: any = undefined;
          const ctx = new Types.Context(
            msg,
            await util_functions.cleanPings(matchingPrefix, msg.guild),
            client,
            store,
            all_command_modules.flatMap((mod) =>
              mod.commands.map((c: { name: string }) => c.name)
            ),
            all_command_modules
          );
          try {
            parseRes = await matchCommand(
              registered_command.grammar,
              msg.content.replace(matchingPrefix, ''),
              ParserTypes,
              ctx
            );
          } catch (e) {
            // TODO: Only show syntax errors once we are sure it did not match anywhere
            if (e instanceof ParseError && e.tokenLevel > 0) {
              possibleMatches.push({
                message: e.message,
                tokenLevel: e.tokenLevel,
                ...registered_command,
              });
            }
          }
          if (parseRes) {
            matched_any = true;
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
                await checkDisabledCommand(msg, registered_command.name);
                if (
                  registered_command.version === 2 ||
                  registered_command.version === 3
                ) {
                  const result = await registered_command.responder(
                    ctx,
                    parseRes,
                    client
                  );
                  const cancelMsg = await msg.channel.awaitMessages({
                    time: 20000,
                    max: 1,
                    filter: (m) =>
                      m.author.id === msg.author.id && m.content === 'cancel',
                  });
                  if ([...cancelMsg.values()].length) {
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
                  await registered_command.responder(msg, parseRes, client);
              } else {
                throw new util_functions.BotError(
                  'user',
                  "You don't have permission to run that command"
                );
              }
            } catch (e) {
              if (e.type == 'user') {
                await message.dbReply({
                  embeds: [
                    new Discord.MessageEmbed()
                      .setColor(util_functions.COLORS.error)
                      .setTitle('Error')
                      .setDescription(util_functions.truncate(e.message, 4096))
                      .setFooter(
                        `Use ${matchingPrefix}support to get an invite to the support server`
                      ),
                  ],
                });
              } else if (e.type == 'bot') {
                await message.dbReply(
                  'An error has occurred. Would you please explain what you were trying to do?'
                );
                const feedback = await msg.channel.awaitMessages({
                  max: 1,
                  time: 20000,
                  filter: (n) => n.author.id == msg.author.id,
                });
                Sentry.configureScope(function (scope: SentryTypes.Scope) {
                  scope.setTag('command', registered_command.name);
                  scope.setUser({
                    id: msg.author.id.toString(),
                    username: msg.author.tag.toString(),
                  });
                  scope.setContext('Info', {
                    'Message Text': msg.content,
                    'Parse Result': parseRes,
                    Feedback: [...feedback.values()][0]
                      ? [...feedback.values()][0].content
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
                  Sentry.configureScope(function (scope: SentryTypes.Scope) {
                    scope.setTag('command', registered_command.name);
                    scope.setUser({
                      id: msg.author.id.toString(),
                      username: msg.author.tag.toString(),
                    });
                    scope.setContext('Info', {
                      'Message Text': msg.content,
                      'Parse Result': parseRes,
                    });
                  });
                  await message.dbReply({
                    embeds: [
                      new Discord.MessageEmbed()
                        .setColor(util_functions.COLORS.error)
                        .setTitle('Something went wrong')
                        .setDescription(
                          'An internal bot error has occurred. This has been reported to the development team.'
                        )
                        .addField(
                          'Error Code',
                          '`' + Sentry.captureException(e) + '`'
                        )
                        .setFooter(
                          `Use ${matchingPrefix}support to get an invite to the support server`
                        ),
                    ],
                  });
                }
              }
            }
          }
        } catch (e) {
          //
        }
    }
    if (!matched_any) {
      let highestTokenLevel = 0;
      for (const match of possibleMatches) {
        if (match.tokenLevel > highestTokenLevel)
          highestTokenLevel = match.tokenLevel;
      }
      if (highestTokenLevel > 0) {
        await showSyntaxError(
          msg,
          possibleMatches.filter((n) => n.tokenLevel >= highestTokenLevel),
          matchingPrefix
        );
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
