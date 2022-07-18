import Discord, {
  ColorResolvable,
  MessageActionRow,
  MessageButton,
  MessageSelectMenu,
  Snowflake,
} from 'discord.js';
import parse_duration from 'parse-duration';
import node_fetch from 'node-fetch';
import * as Types from './types.js';
import { Defer } from './defer.js';
import { PrismaClient } from '@prisma/client';
import { RawGuildData, RawMessageData } from 'discord.js/typings/rawDataTypes';
const prisma = new PrismaClient();

/**
 * Get a random int in a range
 */
export function randomIntFromInterval(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
/**
 * Convert string to simple embed
 */
export function desc_embed(text: string): { embeds: Discord.MessageEmbed[] } {
  return {
    embeds: [
      new Discord.MessageEmbed().setDescription(text).setColor(COLORS.decorate),
    ],
  };
}
/**
 * Truncate a string to a certain length, adding an ellipsis if necessary
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length - 3) + '...';
}
/**
 * Stringify an object into a string
 */
export const COLORS = {
  success: '#1dbb4f' as ColorResolvable,
  warning: '#d8ae2b' as ColorResolvable,
  tip: '#397cd1' as ColorResolvable,
  error: '#e74d4d' as ColorResolvable,
  decorate: '#ff5894' as ColorResolvable,
};
/**
 * Create an embed showing various message types
 * @param {string} text - The embed's description
 * @param {string?} title - (Optional) The embed's title
 */
export function embed(
  text: string,
  type: 'success' | 'warning' | 'tip',
  title?: string
): { embeds: Discord.MessageEmbed[] } {
  return {
    embeds: [
      new Discord.MessageEmbed()
        .setTitle(
          title == undefined
            ? { success: 'Success!', warning: 'Warning!', tip: 'Tip!' }[type]
            : title
        )
        .setDescription(text)
        .setColor(
          { success: '#1dbb4f', warning: '#d8ae2b', tip: '#397cd1' }[
            type
          ] as Discord.ColorResolvable
        ),
    ],
  };
}
/**
 * Get a random item from an array
 */
export function randArrayItem<T>(items: Array<T>): T {
  return items[~~(items.length * Math.random())];
}
export async function schedule_event(
  event: unknown,
  time: string
): Promise<void> {
  let ptime = parse_duration(time, 's') || 10;
  if (ptime < 10) ptime = 10;
  await prisma.timerevents.create({
    data: {
      timestamp: Math.round(Date.now() / 1000) + ptime,
      event: JSON.stringify(event),
    },
  });
}
export function shuffle<T>(a: Array<T>): Array<T> {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export async function awaitMessageComponent(
  msg: Discord.Message,
  options:
    | Discord.AwaitMessageComponentOptions<Discord.MessageComponentInteraction>
    | undefined
): Promise<Discord.MessageComponentInteraction | undefined> {
  try {
    return await msg.awaitMessageComponent(options);
  } catch (err) {
    return undefined;
  }
}
export async function awaitMessageComponentByAuthor(
  msg: Discord.Message,
  options: {
    time?: number;
    filter?: (m: Discord.MessageComponentInteraction) => boolean;
    author: Snowflake;
  }
): Promise<Discord.MessageComponentInteraction | undefined> {
  return new Promise((resolve, reject) => {
    (async () => {
      const f = (i: Discord.Interaction) => {
        const b = i as Discord.MessageComponentInteraction;
        if (
          i.user.id === options.author &&
          (options?.filter == null || options.filter(b))
        ) {
          msg.client.removeListener('interaction', f);
          resolve(b);
        } else if (i.user.id !== options.author) {
          b.reply({
            embeds: [
              new Discord.MessageEmbed()
                .setTitle('Interaction Failed')
                .setDescription(
                  'This interaction can only be used by the person who triggered it'
                )
                .setColor(COLORS.error),
            ],
            ephemeral: true,
          });
        } else {
          b.reply({
            embeds: [
              new Discord.MessageEmbed()
                .setTitle('Interaction Failed')
                .setDescription(
                  'This interaction failed the bot-enforced filter'
                )
                .setColor(COLORS.error),
            ],
            ephemeral: true,
          });
        }
      };
      msg.client.on('interaction', f);
      if (options?.time)
        setTimeout(() => {
          resolve(undefined);
        }, options.time);
    })();
  });
}
export async function confirm(message: Discord.Message): Promise<boolean> {
  const deferred = await Defer.add({
    type: 'SendCancelledMessage',
    channel: message.channel.id,
  });
  deferred.cancelIn(20000);
  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setLabel('Cancel')
      .setStyle('SUCCESS')
      .setCustomId('cancel'),
    new MessageButton()
      .setLabel('Confirm')
      .setStyle('DANGER')
      .setCustomId('confirm')
      .setDisabled(true)
  );
  const msg = await message.channel.send({
    embeds: [
      new Discord.MessageEmbed()
        .setTitle('Click Confirm when it is enabled to confirm')
        .setColor(COLORS.warning),
    ],
    components: [row],
  });
  setTimeout(async () => {
    row.components[1].setDisabled(false);
    msg.edit({
      components: [row],
    });
  }, 3000);
  const interaction = await awaitMessageComponentByAuthor(msg, {
    time: 10000,
    author: message.author.id,
  });
  if (interaction) interaction.deferUpdate();
  if (interaction?.customId == 'confirm') {
    msg.edit({
      embeds: [
        new Discord.MessageEmbed()
          .setTitle('Confirmed')
          .setColor(COLORS.success),
      ],
      components: [],
    });
    await deferred.cancel();
    return true;
  } else {
    msg.edit({
      embeds: [
        new Discord.MessageEmbed()
          .setTitle('Confirmation Failed')
          .setColor(COLORS.error),
      ],
      components: [],
    });
    await deferred.cancel();
    return false;
  }
}
export async function embed_options(
  title: string,
  options: string[],
  set: string[],
  message: EMessage,
  time?: number
): Promise<number | null> {
  const deferred = await Defer.add({
    type: 'SendCancelledMessage',
    channel: message.channel.id,
  });
  deferred.cancelIn(time || 15000);
  const n_options = [];
  for (let i = 0; i < options.length; i++) {
    if (isNaN(parseInt(set[i]))) {
      n_options.push({
        label: options[i],
        value: set[i],
        emoji: set[i],
        md: set[i] + ' ' + options[i],
      });
    } else {
      n_options.push({
        label: options[i],
        value: set[i],
        emoji: message.client.emojis.cache.get(set[i] as Snowflake),
        md: '<:emoji:' + set[i] + '>' + ' ' + options[i],
      });
    }
  }

  const msg = await message.dbReply({
    embeds: [
      new Discord.MessageEmbed().setTitle(title).setColor(COLORS.decorate),
      //.setDescription(n_options.join('\n')),
    ],
    components: [
      new MessageActionRow().addComponents(
        new MessageSelectMenu()
          .setPlaceholder('Nothing selected...')
          .setCustomId('menu')
          .addOptions(n_options)
      ),
    ],
  });
  const interaction = await awaitMessageComponentByAuthor(msg, {
    time: time || 15000,
    author: message.author.id,
  });
  if (interaction?.isSelectMenu() && interaction.values.length > 0) {
    interaction.deferUpdate();
    msg.edit({
      embeds: [
        new Discord.MessageEmbed()
          .setTitle(title)
          .setDescription(n_options[set.indexOf(interaction.values[0])].md)
          .setColor(COLORS.success),
      ],
      components: [],
    });
    await deferred.cancel();
    if (interaction.isSelectMenu()) {
      return set.indexOf(interaction.values[0]);
    } else {
      throw new BotError('bot', 'Invalid component type');
    }
  } else {
    msg.edit({
      embeds: [
        new Discord.MessageEmbed().setTitle('Cancelled').setColor(COLORS.error),
      ],
      components: [],
    });
    await deferred.cancel();
    return null;
  }
}
export async function cleanPings(
  text: string,
  guild: Discord.Guild
): Promise<string> {
  let cleaned = text
    .split('@everyone')
    .join('@​​everyone')
    .split('@here')
    .join('@​​here');
  const role_pings = [...cleaned.matchAll(/<@&[0-9]+>/g)];
  for (const ping of role_pings) {
    const pinged_role = guild.roles.cache.get(
      ping.toString().replace('<@&', '').replace('>', '') as Snowflake
    );
    if (!pinged_role?.mentionable)
      cleaned = cleaned.replace(
        ping.toString(),
        // eslint-disable-next-line no-irregular-whitespace
        `@​${pinged_role ? pinged_role.name : 'deleted-role'}`
      );
  }

  return cleaned;
}
export function assertHasPerms(
  guild: Discord.Guild,
  perms: Array<Discord.PermissionResolvable>
): void {
  for (const perm of perms) {
    if (!guild.me?.permissions.has(perm))
      throw new BotError(
        'user',
        `ModBot needs the ${perm} permission to do this`
      );
  }
}
export function warnIfNoPerms(
  msg: Discord.Message,
  perms: Array<Discord.PermissionResolvable>
): void {
  for (const perm of perms) {
    if (!msg.guild?.me?.permissions.has(perm))
      msg.channel.send(
        desc_embed(
          `ModBot should have the ${perm} permission for best results, continuing anyways`
        )
      );
  }
}
export class BotError extends Error {
  type: string;
  message: string;
  name: string;
  constructor(type: 'user' | 'bot', message: string) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BotError);
    }

    this.name = 'BotError';
    // Custom debugging information
    this.type = type;
    this.message = message;
  }
}
export async function ask(
  question: string,
  time: number,
  msg: EMessage
): Promise<string> {
  const deferred = await Defer.add({
    type: 'SendCancelledMessage',
    channel: msg.channel.id,
  });
  deferred.cancelIn(time);
  await msg.dbReply(question);
  const sb_name = await msg.channel.awaitMessages({
    max: 1,
    time: time,
    filter: (m) => m.author.id == msg.author.id,
  });
  await deferred.cancel();
  if (![...sb_name.values()].length) throw new BotError('user', 'Timed out');
  if ([...[...sb_name.values()][0].attachments.values()].length)
    throw new BotError(
      'user',
      'Attachments are not supported. If you want to add an image, use a link to it'
    );
  return [...sb_name.values()][0].content;
}
export async function askOrNone(
  question: string,
  time: number,
  msg: EMessage
): Promise<string | undefined> {
  const deferred = await Defer.add({
    type: 'SendCancelledMessage',
    channel: msg.channel.id,
  });
  deferred.cancelIn(time);
  return new Promise((resolve, reject) => {
    (async () => {
      let addedEmoji = false;
      const repm = await msg.dbReply({
        content: question,
        components: [
          new MessageActionRow().addComponents(
            new MessageButton()
              .setLabel('Cancel')
              .setStyle('DANGER')
              .setCustomId('cancel')
          ),
        ],
      });
      awaitMessageComponentByAuthor(repm, {
        time: time,
        author: msg.author.id,
      }).then((reactions) => {
        console.log(reactions);
        if (reactions) {
          reactions.deferUpdate();
          addedEmoji = true;
          deferred.cancel();
          resolve('');
        }
      });
      const sb_name = await msg.channel.awaitMessages({
        max: 1,
        time: time,
        filter: (m) => m.author.id == msg.author.id,
      });
      await deferred.cancel();
      if (![...sb_name.values()].length && !addedEmoji) {
        reject(new BotError('user', 'Timed out'));
        return;
      }
      if (!addedEmoji) resolve([...sb_name.values()][0].content);
    })();
  });
}
const stringVars = {
  botName: 'ModBot',
};
export function fillStringVars(text: string): string {
  const regex = /__.*__/g;
  const found = text.match(regex);
  if (found)
    for (const item of found) {
      if (found.toString() === '__botName__')
        text = text.replace(
          item,
          stringVars[item.replace('__', '').replace('__', '') as 'botName']
        );
    }
  return text;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Structures } = (await import('discord.js')) as any;
export class EGuild extends Discord.Guild {
  constructor(client: Discord.Client, guild: RawGuildData) {
    super(client, guild);
  }
  get starboard(): Promise<{
    channel: string;
    server: string;
    stars: number;
  } | null> {
    return prisma.starboards.findFirst({
      where: {
        server: this.id,
      },
    });
  }
  get hasPluralKit(): boolean {
    return !!this.members.cache.get('466378653216014359');
  }
}
Structures.extend('Guild', () => {
  return EGuild;
});

export class EMessage extends Discord.Message {
  constructor(client: Discord.Client, message: RawMessageData) {
    super(client, message);
  }
  async isPoll(): Promise<boolean> {
    return !!(await Types.Poll.query().where('message', this.id)).length;
  }
  ask(question: string, time: number): Promise<string> {
    return ask(question, time, this);
  }
  askOrNone(question: string, time: number): Promise<string | undefined> {
    return askOrNone(question, time, this);
  }
  async dbReply(
    content: string | Discord.MessagePayload | Discord.MessageOptions
  ): Promise<Discord.Message> {
    if (!this.guild)
      throw new BotError('bot', 'dbReply was called outside of a guild');
    const bmsg = await this.channel.send(content);
    await Types.BotMessage.query().insert({
      guild: this.guild.id,
      channel: this.channel.id,
      message: this.id,
      botMessage: bmsg.id,
    });
    return bmsg;
  }
  async getPluralKitSender(): Promise<undefined | Discord.GuildMember> {
    try {
      if (!this.guild) return undefined;
      return this.guild.members.cache.get(
        (
          (await (
            await node_fetch('https://api.pluralkit.me/v1/msg/' + this.id)
          ).json()) as any
        ).sender
      );
    } catch (e) {
      return undefined;
    }
  }
  async getAnonSender(): Promise<null | Discord.GuildMember | undefined> {
    await sleep(200);
    const tmp = await prisma.anonmessages.findFirst({
      where: {
        id: this.id,
      },
    });
    return tmp
      ? this.guild?.members.cache.get(tmp.user as Snowflake)
      : undefined;
  }
  async isPluralKitMessage(): Promise<boolean> {
    if (this.webhookId && (this.guild as EGuild | undefined)?.hasPluralKit) {
      return !!(await this.getPluralKitSender());
    } else {
      return false;
    }
  }
  async isAnonMessage(): Promise<boolean> {
    if (this.webhookId) {
      return !!(await this.getAnonSender());
    } else {
      return false;
    }
  }
  async getRealMember(): Promise<Discord.GuildMember | undefined | null> {
    if (this.webhookId) {
      const anonsender = await this.getAnonSender();
      if (anonsender) {
        return anonsender;
      }
    }
    if (this.webhookId && (this.guild as EGuild | undefined)?.hasPluralKit) {
      return await this.getPluralKitSender();
    } else {
      return this.member;
    }
  }
}
Structures.extend('Message', () => {
  return EMessage;
});
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export function chunk<T>(arr: T[], len: number): T[][] {
  const chunks = [];
  let i = 0;
  const n = arr.length;

  while (i < n) {
    chunks.push(arr.slice(i, (i += len)));
  }

  return chunks;
}
// Make BigInt serializable
// eslint-disable-next-line @typescript-eslint/no-redeclare, no-unused-vars
interface BigInt {
  /** Convert to BigInt to string form in JSON.stringify */
  toJSON: () => string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any)['toJSON'] = function () {
  return this.toString();
};
