import Discord from 'discord.js';
import { Model } from 'objection';
export type Command =
  | {
      command: 'pin';
      text: string;
    }
  | {
      command: 'say';
      text: string;
      channel?: string;
      keep: boolean;
    }
  | {
      command: 'setanonchannel';
      enabled: boolean;
      channel?: string;
    }
  | {
      command: 'listanonchannels';
    }
  | {
      command: 'whosaid';
      id: string;
    }
  | {
      command: 'support';
    }
  | {
      command: 'announce';
    }
  | {
      command: 'reminder';
      action: 'add';
      time: string;
      text: string;
    }
  | {
      command: 'reminder';
      action: 'cancel' | 'copy';
      id: string;
    }
  | {
      command: 'clonepurge';
    }
  | {
      command: 'deletechannel';
    }
  | {
      command: 'channeluser';
      allowed: boolean;
      user: string;
      channel?: string;
    }
  | {
      command: 'archivechannel';
      role: string;
    }
  | {
      command: 'anonban';
      user: string;
      time?: string;
    }
  | {
      command: 'anonunban';
      user: string;
    }
  | {
      command: 'listpinperms';
    }
  | {
      command: 'setpinperms';
      allowed: boolean;
      role: string;
    }
  | {
      command: 'tmpchannel';
      name: string;
      duration: string;
      public: boolean;
    }
  | {
      command: 'autoresponder';
      action: 'add' | 'remove' | 'list';
    }
  | {
      command: 'starboard';
      action: 'enable' | 'disable' | 'configure' | 'fixperms';
    }
  | {
      command: 'ticket';
      action: 'delete';
    }
  | {
      command: 'ticket';
      action: 'create';
      user: string;
      role: string;
    }
  | {
      command: 'star';
      action: 'random';
    }
  | {
      command: 'alpha';
      text: string;
    }
  | {
      command: 'reactionroles';
      action: 'add' | 'edit';
    }
  | {
      command: 'kick';
      user: string;
    }
  | {
      command: 'tmprole';
      action: 'add' | 'remove';
      duration: string;
      role: string;
      user: string;
    }
  | {
      command: 'purge';
      count: string;
    }
  | {
      command: 'setupmute';
    }
  | {
      command: 'mute';
      user: string;
      duration?: string;
    }
  | {
      command: 'unmute';
      user: string;
    }
  | {
      command: 'usercard';
      user: string;
    }
  | {
      command: 'warn' | 'note';
      user: string;
      text: string;
    }
  | {
      command: 'warn' | 'note';
      user: string;
      text: string;
    }
  | {
      command: 'forgive';
      id: string;
    }
  | {
      command: 'invite';
    }
  | {
      command: 'userpic';
    }
  | {
      command: 'ping';
    }
  | {
      command: 'alertchannel';
      action: 'enable' | 'disable' | 'ignore';
    }
  | {
      command: 'joinroles';
      action: 'enable' | 'disable';
    }
  | {
      command: 'eval';
      code: string;
    }
  | {
      command: 'cat';
    }
  | {
      command: 'about';
    }
  | {
      command: 'lockdown';
      time?: string;
    }
  | {
      command: 'unlockdown';
      channel: string;
    }
  | {
      command: 'spoil';
      text: string;
    }
  | {
      command: 'poll';
      text: string;
    }
  | {
      command: 'color';
      color: string;
    }
  | {
      command: 'automod';
      action: 'enable' | 'disable' | 'list' | 'add' | 'remove' | 'inspect';
    }
  | {
      command: 'slowmode';
      action: 'enable' | 'disable';
      channel: string;
    }
  | {
      command: 'suggestion';
    }
  | {
      command: 'prefix';
      action: 'add' | 'remove' | 'list';
    }
  | {
      command: 'embed';
      action: 'create' | 'edit';
    }
  | {
      command: 'addemoji';
      name: string;
      emojiData?: string;
    };
export interface EMessage extends Discord.Message {
  isPoll: boolean;
  guild: EGuild;
}
export interface EGuild extends Discord.Guild {
  hasPluralKit: boolean;
}
export class Prefix extends Model {
  server!: string;
  prefix!: string;
  static get tableName(): string {
    return 'prefixes';
  }
}
export class Reminder extends Model {
  author!: string;
  id!: string;
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
  msg: EMessage;
  prefix: string;
  client: Discord.Client;
  constructor(msg: Discord.Message, prefix: string, client: Discord.Client) {
    this.msg = msg as EMessage;
    this.prefix = prefix;
    this.client = client;
  }
}
