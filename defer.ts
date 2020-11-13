import { Client } from 'discord.js';
import { Model } from 'objection';
import { v4 as uuidv4 } from 'uuid';
import Discord from 'discord.js';
import * as Utils from './util_functions';

interface SendCancelledMessage {
  type: 'SendCancelledMessage';
  channel: string;
}

export type DeferrableAction = SendCancelledMessage;

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
      } else {
        console.warn(`Unknown defer found: ${JSON.stringify(json, null, 4)}`);
      }
    } catch {}
    try {
      await Defer.query().delete().where('id', def.id);
    } catch {}
  }
}
