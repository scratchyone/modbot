const db = require('better-sqlite3')('perms.db3', {});
let util_functions = require('../util_functions.js');
const Discord = require('discord.js');
const Canvas = require('canvas');
const fetch = require('node-fetch');
let invite = {
  name: 'invite',
  syntax: 'm: invite',
  explanation: 'Get a ModBot server invite',
  long_explanation: 'Get a ModBot server invite',
  matcher: (cmd) => cmd.command == 'invite',
  permissions: (msg) => true,
  responder: async (msg, cmd) => {
    await msg.channel.send(
      'https://discord.com/api/oauth2/authorize?client_id=738517864016773241&permissions=8&scope=bot'
    );
  },
};
let autoping = {
  name: 'autoping',
  syntax: 'm: autoping <enable/disable>',
  explanation: 'Make modbot ping a user/role on every new message in a channel',
  matcher: (cmd) => cmd.command == 'autoping',
  permissions: (msg) => msg.member.hasPermission('MANAGE_MESSAGES'),
  responder: async (msg, cmd) => {
    if (!msg.member.hasPermission('MENTION_EVERYONE'))
      throw new util_functions.BotError(
        'user',
        'You need MENTION_EVERYONE perms to be able to run this command'
      );
    if (cmd.action === 'enable') {
      if (
        db
          .prepare('SELECT * FROM autopings WHERE channel=?')
          .get(msg.channel.id)
      )
        throw new util_functions.BotError(
          'user',
          'Autoping is already setup here. You can disable it with `m: autoping disable`'
        );
      let res = await util_functions.ask(
        'Please ping the user(s) and/or role(s) you would like to be pinged on every message',
        20000,
        msg
      );
      db.prepare('INSERT INTO autopings VALUES (?, ?)').run(
        msg.channel.id,
        res
      );
      await msg.channel.send('Done!');
    } else {
      if (
        !db
          .prepare('SELECT * FROM autopings WHERE channel=?')
          .get(msg.channel.id)
      )
        throw new util_functions.BotError(
          'user',
          'Autoping is not setup here. You can enable it with `m: autoping enable`'
        );
      db.prepare('DELETE FROM autopings WHERE channel = ?').run(msg.channel.id);
      await msg.channel.send('Disabled');
    }
  },
};
function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
let userpic = {
  name: 'userpic',
  syntax: 'm: userpic',
  explanation: 'Get a nice message',
  matcher: (cmd) => cmd.command == 'userpic',
  permissions: (msg) => true,
  responder: async (msg, cmd) => {
    const canvas = Canvas.createCanvas(700, 250);
    const ctx = canvas.getContext('2d');
    const background = await Canvas.loadImage('https://picsum.photos/700/250');
    // This uses the canvas dimensions to stretch the image onto the entire canvas
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, 700, 250);
    // Select the style that will be used to fill the text in
    ctx.fillStyle = '#ffffff';
    // Actually fill the text with a solid color
    ctx.textAlign = 'center';
    let name = msg.member.displayName;
    let get_random = function (list) {
      return list[Math.floor(Math.random() * list.length)];
    };
    let messages = [
      `${name}, you're cool`,
      `I like you, ${name}`,
      `I hope you have a good day, ${name}`,
      `${name} is a cool name!`,
      `${name} is a good person`,
      `${name}, you're neat`,
      `I hope you're having a good day, ${name}`,
      `Hi ${name}!`,
      `You're nice, ${name}`,
      `${name} is epic!`,
      `${name} is super poggers`,
      `${name} is the opposite of weirdchamp`,
      `I wish I was as cool as you, ${name}`,
      `I think we could get along well, ${name}`,
    ];
    let message = get_random(messages);
    if (randomIntFromInterval(0, 100) == 50) {
      message = `Fuck you, ${name}`;
    }
    let size = 1100 / message.length;
    ctx.font = size + 'px Consolas';
    ctx.fillText(message, canvas.width / 2, canvas.height / 1.8);
    // Use helpful Attachment class structure to process the file for you
    const attachment = new Discord.MessageAttachment(
      canvas.toBuffer(),
      'image.png'
    );
    msg.channel.send('', attachment);
  },
};
let ping = {
  name: 'ping',
  syntax: 'm: ping',
  explanation: 'Ping the bot',
  matcher: (cmd) => cmd.command == 'ping',
  permissions: (msg) => true,
  responder: async (msg, cmd) => {
    await msg.channel.send(
      `Pong! Took ${new Date().getTime() - msg.createdAt.getTime()}ms`
    );
  },
};
let stats = {
  name: 'stats',
  syntax: 'm: stats',
  explanation: 'Get bot stats',
  matcher: (cmd) => cmd.command == 'stats',
  permissions: (msg) => true,
  responder: async (msg, cmd, client) => {
    await msg.channel.send(
      util_functions.desc_embed(
        `ModBot is in ${client.guilds.cache.array().length} servers, with ${
          client.channels.cache
            .array()
            .filter((channel) => channel.type === 'text').length
        } channels, and ${client.users.cache.array().length} users`
      )
    );
  },
};
let eval_cmd = {
  name: 'eval',
  syntax: 'm: eval <CODE>',
  explanation: 'Run code',
  matcher: (cmd) => cmd.command == 'eval',
  permissions: (msg) =>
    msg.author.id === '234020040830091265' &&
    msg.member.hasPermission('MANAGE_MESSAGES'),
  responder: async (msg, cmd, client) => {
    try {
      let res = eval(
        `(async () => {${cmd.code
          .replace('```js', '')
          .replace('```javascript', '')
          .replace('```', '')}})().catch(e=>msg.channel.send(\`Error: \${e}\`))`
      );
      await msg.channel.send('Ran!');
    } catch (e) {
      msg.channel.send(util_functions.desc_embed(`Error: ${e}`));
    }
  },
};
let update_cmd = {
  name: 'update',
  syntax: 'm: update <ID>',
  explanation: 'Update bot',
  matcher: (cmd) => cmd.command == 'update',
  permissions: (msg) =>
    msg.author.id === '234020040830091265' && process.env.UPDATE_COMMAND,
  responder: async (msg, cmd) => {
    const { exec } = require('child_process');
    try {
      await msg.channel.send('Updating!');
      exec(
        process.env.UPDATE_COMMAND.replace('__ID__', cmd.id),
        (error, stdout, stderr) => {
          if (error) {
            msg.channel.send(
              util_functions.desc_embed(`Error: ${error.message}`)
            );
            return;
          }
          if (stderr) {
            msg.channel.send(util_functions.desc_embed(`Error: ${stderr}`));
            return;
          }
          msg.channel
            .send(util_functions.desc_embed(`${stdout}`))
            .then(() => process.exit(0));
        }
      );
    } catch (e) {}
  },
};
let cat = {
  name: 'cat',
  syntax: 'm: cat',
  explanation: 'By special request, a photo of a cat',
  matcher: (cmd) => cmd.command == 'cat',
  permissions: (msg) => true,
  responder: async (msg, cmd) => {
    const canvas = Canvas.createCanvas(600, 600);
    const ctx = canvas.getContext('2d');
    const background = await Canvas.loadImage('https://cataas.com/cat');
    // This uses the canvas dimensions to stretch the image onto the entire canvas
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, canvas.height / 1.4, 800, 500);
    // Select the style that will be used to fill the text in
    ctx.fillStyle = '#ffffff';
    // Actually fill the text with a solid color
    ctx.textAlign = 'center';

    let message = (await (await fetch('https://catfact.ninja/fact')).json())
      .fact;
    ctx.font = '20pt Consolas';

    ctx.fillText(
      getLines(ctx, message, 600).join('\n'),
      canvas.width / 2,
      canvas.height / 1.3
    );
    // Use helpful Attachment class structure to process the file for you
    const attachment = new Discord.MessageAttachment(
      canvas.toBuffer(),
      'image.png'
    );
    await msg.channel.send(attachment);
  },
};
exports.commandModule = {
  title: 'Utilities',
  description: 'Helpful utility commands',
  commands: [eval_cmd, invite, userpic, ping, cat, stats, update_cmd, autoping],
};
function getLines(ctx, text, maxWidth) {
  var words = text.split(' ');
  var lines = [];
  var currentLine = words[0];

  for (var i = 1; i < words.length; i++) {
    var word = words[i];
    var width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}
