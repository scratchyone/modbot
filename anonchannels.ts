const db = require('better-sqlite3')('perms.db3', {});
const util_functions = require('./util_functions');
const check_anon_channel = db.prepare(
  'SELECT * FROM anonchannels WHERE id=? AND server=?'
);
const check_anon_ban = db.prepare(
  'SELECT * FROM anonbans WHERE user=@user AND server=@server'
);
const insert_anon_ban = db.prepare(
  'INSERT INTO anonbans VALUES (@user, @server)'
);
const remove_anon_ban = db.prepare(
  'DELETE FROM anonbans WHERE user=@user AND server=@server'
);
const add_anonmessage = db.prepare(
  'INSERT INTO anonmessages VALUES (@id, @user, @server)'
);
import Discord from 'discord.js';
const lasts: Map<string, { author: string; count: number }> = new Map();
async function handle_anon_message(msg: Discord.Message) {
  if (!msg.guild || !msg.channel.id) return;
  /*if (msg.attachments.array()) {
    let attachments = msg.attachments.array();
  }*/
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
    (!msg.attachments || msg.attachments.array().length == 0) &&
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
    (await (msg.channel as Discord.TextChannel).fetchWebhooks())
      .array()
      .find((webhook) => webhook.name == 'Anon') ||
    (await (msg.channel as Discord.TextChannel).createWebhook('Anon'));
  //}
  const similars = [
    ...new Set(['Anon', '𝖠non', 'Ꭺnon', 'ꓮnon', '𐊠non', 'A𝗇on']),
  ];
  const am = await anonhook.send(
    await util_functions.cleanPings(msg.content, msg.guild),
    {
      embeds: msg.embeds,
      files: msg.attachments.array().map((n) => n.url),
      username: similars[last.count % similars.length],
    }
  );
  add_anonmessage.run({
    id: am.id,
    user: msg.author.id,
    server: msg.guild.id,
  });
  if (nd)
    try {
      await msg.delete();
    } catch (e) {}
}
exports.handle_anon_message = handle_anon_message;
exports.check_anon_channel = check_anon_channel;
exports.insert_anon_ban = insert_anon_ban;
exports.remove_anon_ban = remove_anon_ban;
exports.check_anon_ban = check_anon_ban;
exports.onNewMessage = async (msg: Discord.Message) => {
  if (
    msg.guild &&
    exports.check_anon_channel.get(msg.channel.id, msg.guild.id)
  ) {
    if (
      !exports.check_anon_ban.get({
        user: msg.author.id,
        server: msg.guild.id,
      })
    )
      await exports.handle_anon_message(msg);
    else {
      await msg.delete();
      const bm = await msg.channel.send(
        util_functions.desc_embed(`${msg.author}, you're banned!`)
      );
      setTimeout(async () => await bm.delete(), 2000);
    }
  }
};
