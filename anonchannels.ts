import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import * as util_functions from './util_functions.js';
import Discord from 'discord.js';
const lasts: Map<string, { author: string; count: number }> = new Map();
function combine_recur(w: string, l: Array<Array<string>>): string[] {
  const output = [];
  for (const x of l[0])
    if (l.length > 1)
      output.push(...combine_recur(w + x.toString(), l.slice(1)));
    else output.push(w + x.toString());
  return output;
}
const chars = {
  A: ['A', '𝖠', '𝙰', 'Α', 'А', 'Ꭺ', 'ᗅ', 'ꓮ', '𐊠'],
  n: ['n'],
  o: ['o', 'ο', 'о'],
};
const similars = combine_recur('', [
  chars['A'],
  chars['n'],
  chars['o'],
  chars['n'],
]);
export async function handle_anon_message(msg: Discord.Message) {
  if (!msg.guild || !msg.channel.id) return;
  let last = lasts.get(msg.channel.id);
  if (!last)
    last = {
      author: msg.author.id,
      count: 0,
    };

  if (last.author != msg.author.id)
    last = { author: msg.author.id, count: last.count + 1 };

  lasts.set(msg.channel.id, last);

  if (msg.content.startsWith('\\')) return;
  let nd = true;
  if (
    (!msg.attachments || [...msg.attachments.values()].length == 0) &&
    !msg.system
  ) {
    try {
      await msg.delete();
    } catch (e) {}
    nd = false;
  }
  if (msg.system) return;
  //let hooks = await msg.channel.fetchWebhooks();
  //let anonhook = hooks.find((n) => n.name == 'Anon ' + msg.author.id);
  //if (!anonhook) {
  //  console.log('Making webhook!');
  const anonhook =
    [
      ...(await (msg.channel as Discord.TextChannel).fetchWebhooks()).values(),
    ].find((webhook) => webhook.name == 'Anon') ||
    (await (msg.channel as Discord.TextChannel).createWebhook('Anon'));
  //}
  const am = await anonhook.send({
    content: await util_functions.cleanPings(msg.content, msg.guild),
    embeds: msg.embeds,
    files: [...msg.attachments.values()].map((n) => n.url),
    username: similars[last.count % similars.length],
  });
  await prisma.anonmessages.create({
    data: {
      id: am.id,
      user: msg.author.id,
      server: msg.guild.id,
    },
  });
  if (nd)
    try {
      await msg.delete();
    } catch (e) {}
}
export const onNewMessage = async (msg: Discord.Message) => {
  if (
    msg.guild &&
    (await prisma.anonchannels.findFirst({
      where: {
        id: msg.channel.id,
        server: msg.guild.id,
      },
    }))
  ) {
    if (
      !(await prisma.anonbans.findFirst({
        where: {
          user: msg.author.id,
          server: msg.guild.id,
        },
      }))
    )
      await handle_anon_message(msg);
    else {
      await msg.delete();
      const bm = await msg.channel.send(
        util_functions.desc_embed(`${msg.author}, you're banned!`)
      );
      setTimeout(async () => await bm.delete(), 2000);
    }
  }
};
