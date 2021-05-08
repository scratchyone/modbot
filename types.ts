import Discord from 'discord.js';
import { Model } from 'objection';
import KeyValueStore from './kvs';
import * as Types from './util_functions';
export interface EGuild extends Discord.Guild {
  hasPluralKit: boolean;
}
export class Prefix extends Model {
  server!: string;
  prefix!: string;
  static get tableName(): string {
    return 'prefixes';
  }
  static newPrefix(server: string, prefix: string): Prefix {
    const p = new Prefix();
    p.server = server;
    p.prefix = prefix;
    return p;
  }
}
export class Reminder extends Model {
  author!: string;
  id!: string;
  text?: string;
  time?: number;
  static get tableName(): string {
    return 'reminders';
  }
}
export class ReminderSubscriber extends Model {
  user!: string;
  id!: string;
  static get tableName(): string {
    return 'reminderSubscribers';
  }
}
export class Context {
  msg: Types.EMessage;
  prefix: string;
  client: Discord.Client;
  store: KeyValueStore;
  validCommands: Array<string>;
  constructor(
    msg: Discord.Message,
    prefix: string,
    client: Discord.Client,
    store: KeyValueStore,
    validCommands: Array<string>
  ) {
    this.msg = msg as Types.EMessage;
    this.prefix = prefix;
    this.client = client;
    this.store = store;
    this.validCommands = validCommands;
  }
}
export class Poll extends Model {
  message!: string;
  static get tableName(): string {
    return 'polls';
  }
}
export class BotMessage extends Model {
  guild!: string;
  channel!: string;
  message!: string;
  botMessage!: string;
  static get tableName(): string {
    return 'botMessages';
  }
}
export class DisabledCommand extends Model {
  server!: string;
  command!: string;
  static get tableName(): string {
    return 'disabledCommands';
  }
}
export class LogChannel extends Model {
  guild!: string;
  channel!: string;
  public static async fromGuild(
    guild: Discord.Guild
  ): Promise<undefined | LogChannel> {
    const channels = await this.query().where('guild', guild.id);
    if (channels.length > 0) {
      return channels[0];
    } else {
      return undefined;
    }
  }
  public toChannel(guild: Discord.Guild): Discord.TextChannel | undefined {
    try {
      const foundChannel = guild.channels.cache.get(this.channel);
      if (!(foundChannel instanceof Discord.TextChannel)) return undefined;
      return foundChannel;
    } catch (e) {
      return undefined;
    }
  }
  public static async insertChannel(
    channel: Discord.TextChannel
  ): Promise<LogChannel> {
    return await this.query().insert({
      channel: channel.id,
      guild: channel.guild.id,
    });
  }
  public async delete(): Promise<number> {
    return await LogChannel.query()
      .delete()
      .where('channel', this.channel)
      .where('guild', this.guild);
  }
  public async log(
    guild: Discord.Guild,
    text: string,
    author?: Discord.GuildMember | null,
    action?: 'action' | 'event'
  ): Promise<Discord.Message | undefined> {
    const discordChannel = this.toChannel(guild);
    if (!discordChannel) return undefined;
    return await discordChannel.send(
      new Discord.MessageEmbed()
        .setTitle(
          action === 'action' || action === undefined ? 'Action' : 'Event'
        )
        .setDescription(text)
        .setColor('#429acc')
        .setAuthor(
          author && (action === 'action' || action === undefined)
            ? author.displayName + ` (@${author.user.tag})`
            : '',
          author && (action === 'action' || action === undefined)
            ? author.user.displayAvatarURL()
            : undefined
        )
    );
  }
  public static async tryToLog(
    msg: Discord.Message | Discord.Guild,
    text: string,
    action?: 'action' | 'event'
  ): Promise<Discord.Message | undefined> {
    if (msg instanceof Discord.Message) {
      if (!msg.guild) return undefined;
      return (await LogChannel.fromGuild(msg.guild))?.log(
        msg.guild,
        text + `\n\n[Link](${msg.url})`,
        msg.member,
        action
      );
    } else {
      return (await LogChannel.fromGuild(msg))?.log(
        msg,
        text,
        undefined,
        action
      );
    }
  }
  static get tableName(): string {
    return 'logChannels';
  }
}
import fetch from 'node-fetch';
export class MediaGen {
  url: string;
  constructor() {
    if (process.env.MEDIAGEN_URL) this.url = process.env.MEDIAGEN_URL;
    else
      throw new Types.BotError(
        'user',
        "MediaGen doesn't appear to be configured for this bot instance, there is no way to proceed"
      );
  }
  public static get enabled(): boolean {
    return !!process.env.MEDIAGEN_URL;
  }
  public generatePoll(votes: { up: number; down: number }): string {
    return this.url + 'poll?up=' + votes.up + '&down=' + votes.down;
  }
  public async owoActions(): Promise<Array<string>> {
    return await (await fetch(this.url + 'owoActions')).json();
  }
  public async assert(): Promise<void> {
    try {
      const working = await fetch(this.url + 'online', { timeout: 1000 });
      if (working.status !== 200) throw Error('');
    } catch (e) {
      throw new Types.BotError(
        'user',
        'This requires a backend service called `MediaGen` which is currently having stability issues. Please try again later.'
      );
    }
  }
}
export class Capability extends Model {
  token!: string;
  user!: string;
  type!: 'reminders' | 'admin';
  expire!: number;
  static get tableName(): string {
    return 'capabilities';
  }
}
export class AlertChannel extends Model {
  server!: string;
  channel!: string;
  static get tableName(): string {
    return 'alert_channels';
  }
}

export class Slowmode extends Model {
  channel!: string;
  time!: number;
  delete_mm!: number;
  static get tableName(): string {
    return 'slowmodes';
  }
}
export class SlowmodedUsers extends Model {
  channel!: string;
  user!: string;
  static get tableName(): string {
    return 'slowmoded_users';
  }
}
