const Discord = require('discord.js');
var parse_duration = require('parse-duration');
const db = require('better-sqlite3')('perms.db3', {});
const fetch = require('node-fetch');
let captcha_emojis = [
  '⏺️',
  '🟠',
  '🟣',
  '👽',
  '🎉',
  '💎',
  '📊',
  '🧬',
  '🔒',
  '📅',
  '💯',
];
function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
function desc_embed(text) {
  return new Discord.MessageEmbed().setDescription(text);
}
function schedule_event(event, time) {
  db.prepare('INSERT INTO timerevents VALUES (@timestamp, @event)').run({
    timestamp: Math.round(Date.now() / 1000) + parse_duration(time, 's'),
    event: JSON.stringify(event),
  });
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
async function confirm(message) {
  let c_emojis = shuffle(captcha_emojis).slice(0, 6);
  let item = randomIntFromInterval(0, 5);
  let msg = await message.channel.send(
    new Discord.MessageEmbed().setTitle(`Click ${c_emojis[item]} to confirm`)
  );
  for (let i = 0; i < c_emojis.length; i++) msg.react(c_emojis[i]);
  let reactions = await msg.awaitReactions(
    (reaction, user) =>
      c_emojis.indexOf(reaction.emoji.name) != -1 &&
      user.id == message.author.id,
    {
      time: 10000,
      max: 1,
    }
  );
  msg.reactions.removeAll();
  if (
    reactions.array().length > 0 &&
    c_emojis.indexOf(reactions.array()[0].emoji.name) === item
  ) {
    msg.edit(new Discord.MessageEmbed().setTitle('Confirmed'));
    return true;
  } else {
    msg.edit(new Discord.MessageEmbed().setTitle('Confirmation Failed'));
    return false;
  }
}
async function embed_options(title, options, set, message, time) {
  let n_options = [];
  for (let i = 0; i < options.length; i++) {
    if (isNaN(set[i])) n_options.push(set[i] + ' ' + options[i]);
    else n_options.push('<:emoji:' + set[i] + '>' + ' ' + options[i]);
  }

  let msg = await message.channel.send(
    new Discord.MessageEmbed()
      .setTitle(title)
      .setDescription(n_options.join('\n'))
  );
  for (let i = 0; i < options.length; i++) msg.react(set[i]);
  let reactions = await msg.awaitReactions(
    (reaction, user) =>
      set.indexOf(reaction.emoji.name) != -1 && user.id == message.author.id,
    {
      time: time || 15000,
      max: 1,
    }
  );
  try {
    await msg.reactions.removeAll();
  } catch (e) {
    await message.channel.send(
      desc_embed(
        "Warning: Failed to remove reactions. This likely means ModBot's permissions are setup incorrectly"
      )
    );
  }
  try {
    await msg.react(reactions.array()[0].emoji.name);
  } catch (e) {}
  if (reactions.array().length > 0) {
    msg.edit(
      new Discord.MessageEmbed()
        .setTitle(title)
        .setDescription(n_options[set.indexOf(reactions.array()[0].emoji.name)])
    );
    return set.indexOf(reactions.array()[0].emoji.name);
  } else {
    msg.edit(new Discord.MessageEmbed().setTitle('Cancelled'));
    return null;
  }
}
async function cleanPings(text, guild) {
  let cleaned = text
    .split('@everyone')
    .join('@​​everyone')
    .split('@here')
    .join('@​​here');
  let role_pings = [...cleaned.matchAll(/<@&[0-9]+>/g)];
  for (const ping of role_pings) {
    let pinged_role = guild.roles.cache.get(
      ping.toString().replace('<@&', '').replace('>', '')
    );
    // eslint-disable-next-line no-irregular-whitespace
    cleaned = cleaned.replace(ping, `@​${pinged_role.name}`);
  }

  return cleaned;
}
async function checkSelfPermissions(client, guild) {
  return guild.members.cache.get(client.user.id).hasPermission('ADMINISTRATOR');
}
function assertHasPerms(guild, perms) {
  for (let perm of perms) {
    if (!guild.me.hasPermission(perm))
      throw new BotError(
        'user',
        `ModBot needs the ${perm} permission to do this`
      );
  }
}
function warnIfNoPerms(msg, perms) {
  for (let perm of perms) {
    if (!msg.guild.me.hasPermission(perm))
      msg.channel.send(
        desc_embed(
          `ModBot should have the ${perm} permission for best results, continuing anyways`
        )
      );
  }
}
exports.warnIfNoPerms = warnIfNoPerms;
exports.assertHasPerms = assertHasPerms;
class BotError extends Error {
  constructor(type, message, ...params) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(...params);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BotError);
    }

    this.name = 'BotError';
    // Custom debugging information
    this.type = type;
    this.message = message;
  }
}
exports.attachmentToUrl = async (attachment, client) => {
  let uploadChannel = client.channels.cache.get(process.env.UPLOAD_CHANNEL);
  let imageMessage = await uploadChannel.send(attachment);
  return [imageMessage.attachments.array()[0].url, imageMessage];
};
exports.desc_embed = desc_embed;
exports.shuffle = shuffle;
exports.schedule_event = schedule_event;
exports.embed_options = embed_options;
exports.confirm = confirm;
exports.cleanPings = cleanPings;
exports.checkSelfPermissions = checkSelfPermissions;
exports.BotError = BotError;
exports.ask = async (question, time, msg) => {
  await msg.channel.send(question);
  let sb_name = await msg.channel.awaitMessages(
    (m) => m.author.id == msg.author.id,
    {
      max: 1,
      time: time,
    }
  );
  if (!sb_name.array().length) throw new exports.BotError('user', 'Timed out');
  return sb_name.array()[0].content;
};
let stringVars = {
  botName: 'ModBot',
};
exports.fillStringVars = (text) => {
  const regex = /__.*__/g;
  const found = text.match(regex);
  for (let item of found) {
    text = text.replace(
      item,
      stringVars[item.replace('__', '').replace('__', '')]
    );
  }
  return text;
};
const { Structures } = require('discord.js');
Structures.extend('Guild', (Guild) => {
  return class EGuild extends Guild {
    constructor(client, guild) {
      super(client, guild);
    }
    get starboard() {
      return db.prepare('SELECT * FROM starboards WHERE server=?').get(this.id);
    }
    get hasPluralKit() {
      return !!this.members.cache.get('466378653216014359');
    }
  };
});
let check_poll = db.prepare('SELECT * FROM polls WHERE message=?');
exports.EMessage = class EMessage extends Discord.Message {
  constructor(client, message, channel) {
    super(client, message, channel);
  }
  get isPoll() {
    return !!check_poll.get(this.id);
  }
  async getPluralKitSender() {
    try {
      return this.guild.members.cache.get(
        (
          await (
            await fetch('https://api.pluralkit.me/v1/msg/' + this.id)
          ).json()
        ).sender
      );
    } catch (e) {
      return null;
    }
  }
  async getAnonSender() {
    await sleep(200);
    let tmp = db.prepare('SELECT * FROM anonmessages WHERE id=?').get(this.id);
    return tmp ? this.guild.members.cache.get(tmp.user) : null;
  }
  async isPluralKitMessage() {
    if (this.webhookID && this.guild.hasPluralKit) {
      return !!(await this.getPluralKitSender());
    } else {
      return false;
    }
  }
  async isAnonMessage() {
    if (this.webhookID) {
      return !!(await this.getAnonSender());
    } else {
      return false;
    }
  }
  async getRealMember() {
    if (this.webhookID) {
      let anonsender = await this.getAnonSender();
      if (anonsender) {
        return anonsender;
      }
    }
    if (this.webhookID && this.guild.hasPluralKit) {
      return await this.getPluralKitSender();
    } else {
      return this.member;
    }
  }
};
Structures.extend('Message', () => {
  return exports.EMessage;
});
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
