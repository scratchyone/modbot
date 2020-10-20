/* eslint-disable @typescript-eslint/no-var-requires */
import * as util_functions from '../util_functions';
import Discord from 'discord.js';
import { Command, Context } from '../types';
import * as Types from '../types';
const POLLTIME = 5000;
try {
  require('../credentials.json');
} catch (e) {
  console.error(
    'Reddit credentials not found, needed for subscription submodule to load'
  );
}
const creds = require('../credentials.json');
const Reddit = require('reddit');
const reddit = new Reddit(creds);

const subscribe = {
  name: 'subscribe',
  syntax: 'm: subscribe <reddit>',
  explanation: 'Subscribe to a stream',
  matcher: (cmd: Command) => cmd.command == 'subscribe',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'subscribe',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_WEBHOOKS'),
  version: 2,
  responder: async (ctx: Context, cmd: Command) => {
    if (cmd.command !== 'subscribe' || !ctx.msg.guild) return;
    util_functions.assertHasPerms(ctx.msg.guild, ['MANAGE_WEBHOOKS']);
    if (cmd.action === 'reddit') {
      const sub = (await util_functions.ask('What subreddit?', 50000, ctx.msg))
        .replace('/r/', '')
        .replace('r/', '');
      const webhook = await (ctx.msg
        .channel as Discord.TextChannel).createWebhook(
        `ModBot /r/${sub} Subscription`,
        { reason: `Created by ${ctx.msg.author.tag}` }
      );
      await Types.Subscription.addRedditSubscription(sub, webhook, ctx.msg);
      await ctx.msg.dbReply(
        util_functions.embed(
          `Subscribed to /r/${sub}! If you'd like to modify the subscription's name or profile picture, open channel settings and go to Integrations -> Webhooks, and then edit "ModBot /r/${sub} Subscription". To unsubscribe, use \`!unsubscribe reddit\`!`,
          'success'
        )
      );
      await Types.LogChannel.tryToLog(
        ctx.msg,
        `Created subscription to /r/${sub} in ${ctx.msg.channel}`
      );
    }
  },
};
const unsubscribe = {
  name: 'unsubscribe',
  syntax: 'm: unsubscribe <reddit>',
  explanation: 'Unsubscribe from a stream',
  matcher: (cmd: Command) => cmd.command == 'unsubscribe',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'unsubscribe',
  permissions: (msg: Discord.Message) =>
    msg.member?.hasPermission('MANAGE_WEBHOOKS'),
  version: 2,
  responder: async (ctx: Context, cmd: Command) => {
    if (cmd.command !== 'unsubscribe' || !ctx.msg.guild) return;
    util_functions.assertHasPerms(ctx.msg.guild, ['MANAGE_WEBHOOKS']);
    if (cmd.action === 'reddit') {
      const sub = (await util_functions.ask('What subreddit?', 50000, ctx.msg))
        .replace('/r/', '')
        .replace('r/', '');
      const oldWHs = await Types.Subscription.query()
        .whereRaw('lower(subreddit) = ?', [sub.toLowerCase()])
        .where('channel', ctx.msg.channel.id);
      const res = await Types.Subscription.query()
        .delete()
        .whereRaw('lower(subreddit) = ?', [sub.toLowerCase()])
        .where('channel', ctx.msg.channel.id);
      if (res === 0)
        throw new util_functions.BotError(
          'user',
          'Subscription not found! Are you running this command in the channel it was created in?'
        );
      try {
        const webhookClient = new Discord.WebhookClient(
          oldWHs[0].webhookid,
          oldWHs[0].webhooktoken
        );
        await webhookClient.delete();
      } catch (e) {}
      await ctx.msg.dbReply(
        util_functions.embed('Removed subscription!', 'success')
      );
      await Types.LogChannel.tryToLog(
        ctx.msg,
        `Removed subscription to /r/${sub} in ${ctx.msg.channel}`
      );
    }
  },
};
function truncateString(str: string, num: number): string {
  // If the length of str is less than or equal to num
  // just return str--don't truncate it.
  if (str.length <= num) {
    return str;
  }
  // Return str truncated with '...' concatenated to the end of str.
  return str.slice(0, num) + '...';
}
interface Submission {
  title: string;
  selftext: string;
  permalink: string;
  url: string;
  author: string;
  id: string;
  subreddit: string;
}
async function newSubmission(
  submission: Submission,
  subscription: Types.Subscription
) {
  try {
    const webhookClient = new Discord.WebhookClient(
      subscription.webhookid,
      subscription.webhooktoken
    );
    await webhookClient.send(
      new Discord.MessageEmbed()
        .setTitle(submission.title)
        .setDescription(truncateString(submission.selftext || '', 2000))
        .setURL('https://reddit.com' + submission.permalink)
        .setImage(submission.url)
        .setAuthor('By ' + submission.author)
        .setFooter(`/r/${submission.subreddit}`)
    );
  } catch (e) {
    console.error(e);
  }
}
function reverse<T>(array: T[]) {
  return array.map((item: T, idx: number) => array[array.length - 1 - idx]);
}
exports.commandModule = {
  title: 'Subscriptions',
  description: 'Commands for subscribing to various streams like Reddit',
  commands: [subscribe, unsubscribe],
  cog: async (discClient: Discord.Client) => {
    const seenPosts: Set<string> = new Set();
    const seenSubs: Set<string> = new Set();
    setInterval(async () => {
      const subscriptions = await Types.Subscription.query();
      for (const sub of subscriptions) {
        if (sub.type === 'reddit') {
          const submissions: {
            data: { children: { data: Submission }[] };
          } = await reddit.get(
            `/r/${sub.subreddit?.replace('/', '')}/new.json?sort=new`
          );
          for (const validSubmission of reverse(
            submissions.data.children.filter((p) => !seenPosts.has(p.data.id))
          )) {
            if (seenSubs.has(sub.subreddit || ''))
              newSubmission(validSubmission.data, sub);
            seenPosts.add(validSubmission.data.id);
          }
          seenSubs.add(sub.subreddit || '');
        }
      }
    }, POLLTIME);
    discClient.on('channelDelete', async (channel) => {
      await Types.Subscription.query().delete().where('channel', channel.id);
    });
  },
};
