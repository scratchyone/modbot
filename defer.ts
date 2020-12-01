import { Client, MessageEmbed } from 'discord.js';
import { Model } from 'objection';
import { v4 as uuidv4 } from 'uuid';
import Discord from 'discord.js';
import * as Utils from './util_functions';

interface SendCancelledMessage {
  type: 'SendCancelledMessage';
  channel: string;
}
interface SendMessage {
  type: 'SendMessage';
  channel: string;
  content: Discord.MessageOptions;
}

interface UpdateTmpDeletionMessage {
  type: 'UpdateTmpDeletionMessage';
  channel: string;
  message: string;
  deletionTime: string;
}

export type DeferrableAction =
  | SendCancelledMessage
  | UpdateTmpDeletionMessage
  | SendMessage;

export class Defer extends Model {
  id!: string;
  data!: string;
  static get tableName(): string {
    return 'defers';
  }
  get json(): DeferrableAction {
    return JSON.parse(this.data);
  }
  public async cancel(): Promise<void> {
    await Defer.query().delete().where('id', this.id);
  }
  public cancelIn(ms: number): void {
    setTimeout(async () => {
      await Defer.query().delete().where('id', this.id);
    }, ms);
  }
  public static async add(action: DeferrableAction): Promise<Defer> {
    return await Defer.query().insert({
      id: uuidv4(),
      data: JSON.stringify(action),
    });
  }
}
export async function processDeferredOnStart(client: Client): Promise<void> {
  for (const def of await Defer.query()) {
    try {
      const json = def.json;
      if (json.type === 'SendCancelledMessage') {
        (client.channels.cache.get(json.channel) as Discord.TextChannel).send(
          Utils.embed(
            'This action has been cancelled due to a bot restart, please try again',
            'warning',
            'Cancelled'
          )
        );
      } else if (json.type === 'SendMessage') {
        (client.channels.cache.get(json.channel) as Discord.TextChannel).send(
          json.content
        );
      } else if (json.type === 'UpdateTmpDeletionMessage') {
        (
          await (client.channels.cache.get(
            json.channel
          ) as Discord.TextChannel).messages.fetch(json.message)
        ).edit(
          new MessageEmbed().setDescription(
            `This channel will be deleted ${json.deletionTime} after this message was sent`
          )
        );
      } else {
        console.warn(`Unknown defer found: ${JSON.stringify(json, null, 4)}`);
      }
    } catch (e) {
      console.error(e);
    }
    try {
      await Defer.query().delete().where('id', def.id);
    } catch {}
  }
}
