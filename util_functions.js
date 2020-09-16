const Discord = require('discord.js');
var parse_duration = require('parse-duration');
const db = require('better-sqlite3')('perms.db3', {});
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
async function embed_options(title, options, set, message) {
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
      time: 15000,
      max: 1,
    }
  );
  await msg.reactions.removeAll();
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
  let cleaned = text.split('@everyone').join('@​​everyone');
  let role_pings = [...cleaned.matchAll(/<@&[0-9]+>/g)];
  for (ping of role_pings) {
    let pinged_role = guild.roles.cache.get(
      ping.toString().replace('<@&', '').replace('>', '')
    );
    if (pinged_role.name != 'here')
      cleaned = cleaned.replace(ping, `@${pinged_role.name}`);
    else cleaned = cleaned.replace(ping, `@​${pinged_role.name}`);
  }

  return cleaned;
}
async function checkSelfPermissions(client, guild) {
  return guild.members.cache.get(client.user.id).hasPermission('ADMINISTRATOR');
}
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
const { check } = require('prettier');
Structures.extend('Guild', (Guild) => {
  return class EGuild extends Guild {
    constructor(client, guild) {
      super(client, guild);
    }
    get starboard() {
      return db.prepare('SELECT * FROM starboards WHERE server=?').get(this.id);
    }
  };
});
let check_poll = db.prepare('SELECT * FROM polls WHERE message=?');
Structures.extend('Message', (Message) => {
  return class EMessage extends Message {
    constructor(client, message, channel) {
      super(client, message, channel);
    }
    get isPoll() {
      return !!check_poll.get(this.id);
    }
  };
});
