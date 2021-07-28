import Discord, {
  MessageActionRow,
  MessageButton,
  Snowflake,
} from 'discord.js';
import parse_duration from 'parse-duration';
import node_fetch from 'node-fetch';
import * as Types from './types';
import { Defer } from './defer';
import { PrismaClient } from '@prisma/client';
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
  return { embeds: [new Discord.MessageEmbed().setDescription(text)] };
}
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
      .setCustomId('cancel')
  );
  const msg = await message.channel.send({
    embeds: [
      new Discord.MessageEmbed().setTitle(
        'Click Confirm when it appears to confirm'
      ),
    ],
    components: [row],
  });
  setTimeout(async () => {
    msg.edit({
      components: [
        row.addComponents(
          new MessageButton()
            .setLabel('Confirm')
            .setStyle('DANGER')
            .setCustomId('confirm')
        ),
      ],
    });
  }, 3000);
  const interaction = await awaitMessageComponent(msg, {
    time: 10000,
    filter: (int) => int.user.id === message.author.id,
  });
  if (interaction) interaction.deferUpdate();
  if (interaction?.customId == 'confirm') {
    msg.edit({
      embeds: [new Discord.MessageEmbed().setTitle('Confirmed')],
      components: [],
    });
    await deferred.cancel();
    return true;
  } else {
    msg.edit({
      embeds: [new Discord.MessageEmbed().setTitle('Confirmation Failed')],
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
    if (isNaN(parseInt(set[i]))) n_options.push(set[i] + ' ' + options[i]);
    else n_options.push('<:emoji:' + set[i] + '>' + ' ' + options[i]);
  }

  const msg = await message.dbReply({
    embeds: [
      new Discord.MessageEmbed()
        .setTitle(title)
        .setDescription(n_options.join('\n')),
    ],
  });
  for (let i = 0; i < options.length; i++) msg.react(set[i]);
  const reactions = await msg.awaitReactions({
    time: time || 15000,
    max: 1,
    filter: (reaction, user) =>
      set.indexOf(reaction.emoji.name || '') != -1 &&
      user.id == message.author.id,
  });
  try {
    await msg.reactions.removeAll();
  } catch (e) {
    await message.channel.send(
      desc_embed(
        "Warning: Failed to remove reactions. This likely means ModBot's permissions are setup incorrectly"
      )
    );
  }
  try {
    await msg.react(reactions.array()[0].emoji.name || '');
  } catch (e) {}
  if (reactions.array().length > 0) {
    msg.edit({
      embeds: [
        new Discord.MessageEmbed()
          .setTitle(title)
          .setDescription(
            n_options[set.indexOf(reactions.array()[0].emoji.name || '')]
          ),
      ],
    });
    await deferred.cancel();
    return set.indexOf(reactions.array()[0].emoji.name || '');
  } else {
    msg.edit({ embeds: [new Discord.MessageEmbed().setTitle('Cancelled')] });
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
  if (!sb_name.array().length) throw new exports.BotError('user', 'Timed out');
  if (sb_name.array()[0].attachments.array().length)
    throw new exports.BotError(
      'user',
      'Attachments are not supported. If you want to add an image, use a link to it'
    );
  return sb_name.array()[0].content;
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
      awaitMessageComponent(repm, {
        time: time,
        filter: (r) => r.user.id === msg.author.id,
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
      if (!sb_name.array().length && !addedEmoji) {
        reject(new exports.BotError('user', 'Timed out'));
        return;
      }
      if (!addedEmoji) resolve(sb_name.array()[0].content);
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
const { Structures } = require('discord.js');
export class EGuild extends Discord.Guild {
  constructor(client: Discord.Client, guild: Discord.Guild) {
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
  constructor(
    client: Discord.Client,
    message: Discord.Message,
    channel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel
  ) {
    super(client, message, channel);
  }
  async isPoll(): Promise<boolean> {
    return !!(await Types.Poll.query().where('message', this.id));
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
          await (
            await node_fetch('https://api.pluralkit.me/v1/msg/' + this.id)
          ).json()
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
  return exports.EMessage;
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
