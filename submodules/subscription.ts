/* eslint-disable @typescript-eslint/no-var-requires */
import * as util_functions from '../util_functions';
const db = require('better-sqlite3')('perms.db3', {});
import Discord from 'discord.js';
import { Command, Context } from '../types';
import * as Types from '../types';
import { SubmissionStream } from 'snoostorm';
import Snoowrap from 'snoowrap';
import { truncate } from 'humanize-plus';
const POLLTIME = 5000;
try {
  require('../credentials.json');
} catch (e) {
  console.error(
    'Reddit credentials not found, needed for subscription submodule to load'
  );
}
const creds = require('../credentials.json');
const client = new Snoowrap(creds);
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
      const subscription = await Types.Subscription.addRedditSubscription(
        sub,
        webhook,
        ctx.msg
      );
      const submissions = new SubmissionStream(client, {
        subreddit: sub,
        limit: 10,
        pollTime: POLLTIME,
      });
      submissions.on('item', (s) =>
        newSubmission(s, submissions, subscription)
      );
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
async function newSubmission(
  submission: Snoowrap.Submission,
  listener: SubmissionStream,
  subscription: Types.Subscription
) {
  if (
    !(
      await Types.Subscription.query().where(
        'webhookid',
        subscription.webhookid
      )
    ).length
  )
    listener.end();
  try {
    const webhookClient = new Discord.WebhookClient(
      subscription.webhookid,
      subscription.webhooktoken
    );
    await webhookClient.send(
      new Discord.MessageEmbed()
        .setTitle(submission.title)
        .setDescription(truncateString(submission.selftext, 2000))
        .setURL('https://reddit.com' + submission.permalink)
        .setImage(submission.url)
        .setAuthor('By ' + submission.author.name)
        .setFooter(`/r/${subscription.subreddit}`)
    );
  } catch (e) {
    console.error(e);
  }
}
exports.commandModule = {
  title: 'Subscriptions',
  description: 'Commands for subscribing to various streams like Reddit',
  commands: [subscribe, unsubscribe],
  cog: async (discClient: Discord.Client) => {
    const subscriptions = await Types.Subscription.query();
    for (const sub of subscriptions) {
      if (sub.type === 'reddit') {
        const submissions = new SubmissionStream(client, {
          subreddit: sub.subreddit,
          limit: 10,
          pollTime: POLLTIME,
        });
        submissions.on('item', (s) => newSubmission(s, submissions, sub));
      }
    }
    discClient.on('channelDelete', async (channel) => {
      await Types.Subscription.query().delete().where('channel', channel.id);
    });
  },
};
