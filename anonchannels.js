const db = require('better-sqlite3')('perms.db3', {});
let util_functions = require('./util_functions');
let check_anon_channel = db.prepare(
  'SELECT * FROM anonchannels WHERE id=? AND server=?'
);
let check_anon_ban = db.prepare(
  'SELECT * FROM anonbans WHERE user=@user AND server=@server'
);
let insert_anon_ban = db.prepare(
  'INSERT INTO anonbans VALUES (@user, @server)'
);
let remove_anon_ban = db.prepare(
  'DELETE FROM anonbans WHERE user=@user AND server=@server'
);
let add_anonmessage = db.prepare(
  'INSERT INTO anonmessages VALUES (@id, @user, @server)'
);
async function handle_anon_message(msg) {
  /*if (msg.attachments.array()) {
    let attachments = msg.attachments.array();
  }*/
  if (msg.content.startsWith('\\')) return;
  let nd = true;
  if (!msg.attachments || msg.attachments.array().length == 0) {
    try {
      await msg.delete();
    } catch (e) {}
    nd = false;
  }
  //let hooks = await msg.channel.fetchWebhooks();
  //let anonhook = hooks.find((n) => n.name == 'Anon ' + msg.author.id);
  //if (!anonhook) {
  //  console.log('Making webhook!');
  const anonhook = await msg.channel.createWebhook('Anon');
  //}
  let am = await anonhook.send(
    await util_functions.cleanPings(msg.content, msg.guild),
    {
      embeds: msg.embeds,
      files: msg.attachments.array().map((n) => n.url),
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
  await anonhook.delete();
}
exports.handle_anon_message = handle_anon_message;
exports.check_anon_channel = check_anon_channel;
exports.insert_anon_ban = insert_anon_ban;
exports.remove_anon_ban = remove_anon_ban;
exports.check_anon_ban = check_anon_ban;
