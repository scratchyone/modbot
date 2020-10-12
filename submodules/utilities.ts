/* eslint-disable no-empty */
import * as util_functions from '../util_functions';
import moment from 'moment';
import Discord from 'discord.js';
import { Command, EGuild, Prefix, Context } from '../types';
import * as Types from '../types';
import Canvas from 'canvas';
import fetch from 'node-fetch';
const invite = {
  name: 'invite',
  syntax: 'm: invite',
  explanation: util_functions.fillStringVars('Get a __botName__ server invite'),
  matcher: (cmd: Command) => cmd.command == 'invite',
  permissions: () => true,
  version: 2,
  responder: async (ctx: Context) => {
    await ctx.msg.dbReply(
      new Discord.MessageEmbed()
        .setURL(
          'https://discord.com/api/oauth2/authorize?client_id=738517864016773241&permissions=8&scope=bot'
        )
        .setTitle('Click here to invite ModBot to your server')
        .setDescription('Thank you for using ModBot! <:pOg:759186176094765057>')
        .setColor('#9168a6')
        .setFooter(
          process.env.AUTHOR_NAME
            ? 'Made with ❤️ by ' + process.env.AUTHOR_NAME
            : 'Made with ❤️'
        )
    );
  },
};
exports.reRenderPoll = async (message: Discord.Message) => {
  try {
    await message.edit({
      embed: message.embeds[0].setImage(
        'https://modbot.scratchyone.com/mediagen/poll?up=' +
          ((message.reactions.cache
            .array()
            .filter((r) => r.emoji.name == '👍')[0].count || 1) -
            1) +
          '&down=' +
          ((message.reactions.cache
            .array()
            .filter((r) => r.emoji.name == '👎')[0].count || 1) -
            1)
      ),
    });
  } catch (e) {
    console.log(e);
  }
};
const poll = {
  name: 'poll',
  syntax: 'm: poll <TEXT>',
  explanation: 'Run a yes/no poll',
  matcher: (cmd: Command) => cmd.command == 'poll',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'poll',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage, cmd: Command) => {
    if (cmd.command !== 'poll') return;
    util_functions.warnIfNoPerms(msg, ['MANAGE_MESSAGES']);
    try {
      await msg.delete();
    } catch (e) {}
    const warning = await msg.channel.send(
      'EPILEPSY WARNING, POLL WILL FLASH WHENEVER THERE IS A NEW VOTE'
    );
    setTimeout(() => warning.delete(), 8000);
    const pollMsg = await msg.channel.send(
      new Discord.MessageEmbed()
        .setAuthor(
          msg.member?.displayName || msg.author.username,
          msg.author.displayAvatarURL()
        )
        .setTitle(cmd.text)
        .setImage(
          'https://modbot.scratchyone.com/mediagen/poll?up=' + 0 + '&down=' + 0
        )
    );
    await pollMsg.react('👍');
    await pollMsg.react('👎');
    await Types.Poll.query().insert({ message: pollMsg.id });
  },
};
const spoil = {
  name: 'spoil',
  syntax: 'm: spoil <TEXT>',
  explanation: 'Repost message with all attachments spoilered',
  matcher: (cmd: Command) => cmd.command == 'spoil',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'spoil',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage, cmd: Command) => {
    if (cmd.command !== 'spoil') return;
    util_functions.warnIfNoPerms(msg, ['MANAGE_MESSAGES']);

    if (msg.guild !== null && msg.channel.type == 'text') {
      const uuser = msg.member;
      if (!uuser) throw new Error('User not found');
      const loghook = await msg.channel.createWebhook(uuser.displayName, {
        avatar: uuser.user.displayAvatarURL(),
      });
      const files = msg.attachments.array().map((attachment) => {
        return { ...attachment, name: 'SPOILER_' + attachment.name };
      });
      console.log(files);
      await loghook.send({
        content: cmd.text,
        files: files,
      });
      await loghook.delete();
    }
    try {
      await msg.delete();
    } catch (e) {}
  },
};
const pick = {
  name: 'pick',
  syntax: 'm: pick <option one; option two; etc>',
  explanation: 'Pick a random item from a list of options, seperated by `;`',
  matcher: (cmd: Command) => cmd.command == 'pick',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'pick',
  version: 2,
  permissions: () => true,
  responder: async (ctx: Types.Context, cmd: Command) => {
    if (cmd.command !== 'pick' || !ctx.msg.guild) return;
    ctx.msg.dbReply(
      `I choose ${await util_functions.cleanPings(
        util_functions.randArrayItem(cmd.text.split('; ').join(';').split(';')),
        ctx.msg.guild
      )}`
    );
  },
};
const suggestion = {
  name: 'suggestion',
  syntax: 'm: suggestion',
  explanation: 'Submit a suggestion to ModBot',
  matcher: (cmd: Command) => cmd.command == 'suggestion',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'suggestion',
  permissions: () =>
    process.env.SUGGESTIONMANAGER_URL && process.env.SUGGESTIONMANAGER_TOKEN,
  responder: async (msg: util_functions.EMessage) => {
    if (
      process.env.SUGGESTIONMANAGER_URL &&
      process.env.SUGGESTIONMANAGER_TOKEN
    ) {
      const st = await util_functions.ask(
        'What is your suggestion?',
        120000,
        msg
      );
      const sn = msg.member ? msg.member.displayName : msg.author.username;
      console.log(
        await (
          await fetch(
            process.env.SUGGESTIONMANAGER_URL.split('/')[
              process.env.SUGGESTIONMANAGER_URL.split('/').length - 1
            ] === ''
              ? process.env.SUGGESTIONMANAGER_URL.split('/').join('/') +
                  'graphql'
              : process.env.SUGGESTIONMANAGER_URL.split('/').join('/') +
                  '/graphql',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                operationName: 'addSuggestion',
                variables: {
                  displayName: sn,
                  suggestionText: st,
                  key: process.env.SUGGESTIONMANAGER_TOKEN,
                },
                query:
                  'mutation addSuggestion($displayName: String!, $suggestionText: String!, $key: String!) {\n  addSuggestion(displayName: $displayName, suggestionText: $suggestionText, key: $key) {\n    project {\n      projectName\n      __typename\n    }\n    __typename\n  }\n}\n',
              }),
            }
          )
        ).json()
      );
      await msg.dbReply(
        'Submitted, thank you! You can also submit suggestions at https://suggestionmanager.com/suggest/a621c969-5028-44f5-8482-74467e509639/'
      );
    }
  },
};
const prefix = {
  name: 'prefix',
  syntax: 'm: prefix <add/remove/list>',
  explanation: 'Change bot prefixes',
  matcher: (cmd: Command) => cmd.command == 'prefix',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'prefix',
  permissions: (msg: util_functions.EMessage) =>
    msg.member?.hasPermission('MANAGE_MESSAGES'),
  responder: async (msg: util_functions.EMessage, cmd: Command) => {
    if (cmd.command !== 'prefix' || !msg.guild) return;
    if (cmd.action == 'list') {
      msg.dbReply(
        util_functions.desc_embed(
          [
            ...(await Prefix.query().where('server', msg.guild.id)),
            { server: msg.guild.id, prefix: 'm: ' } as Prefix,
          ]
            .map((p: Prefix) => `\`${p.prefix}\``)
            .join('\n')
        )
      );
    }
    if (cmd.action == 'add') {
      const prefix = await util_functions.ask(
        'What should the prefix be?',
        20000,
        msg
      );
      if (prefix === 'm: ')
        throw new util_functions.BotError('user', 'Prefix already registered');
      if (prefix.length > 5)
        throw new util_functions.BotError('user', 'Prefix is too long');
      try {
        await Prefix.query().insert({ server: msg.guild.id, prefix });
        await msg.dbReply('Added!');
      } catch (e) {
        await msg.dbReply('Failed to add prefix. Does it already exist?');
      }
    }
    if (cmd.action == 'remove') {
      const prefix = await util_functions.ask(
        'What prefix do you want to remove?',
        20000,
        msg
      );
      if (prefix === 'm: ')
        throw new util_functions.BotError(
          'user',
          "Default prefix can't be removed"
        );
      try {
        await Prefix.query()
          .delete()
          .where('server', msg.guild.id)
          .where('prefix', prefix);
        await msg.dbReply('Removed!');
      } catch (e) {
        await msg.dbReply('Failed to remove prefix');
      }
    }
  },
};
function randomIntFromInterval(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
const userpic = {
  name: 'userpic',
  syntax: 'm: userpic',
  explanation: 'Get a nice message',
  matcher: (cmd: Command) => cmd.command == 'userpic',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'userpic',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage) => {
    msg.channel.startTyping();
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
    const name = msg.member?.displayName || msg.author.username;
    const get_random = function (list: Array<string>) {
      return list[Math.floor(Math.random() * list.length)];
    };
    const messages = [
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
    const size = 1100 / message.length;
    ctx.font = size + 'px Consolas';
    ctx.fillText(message, canvas.width / 2, canvas.height / 1.8);
    // Use helpful Attachment class structure to process the file for you
    const attachment = new Discord.MessageAttachment(
      canvas.toBuffer(),
      'image.png'
    );
    msg.dbReply('', attachment);
    msg.channel.stopTyping();
  },
};
import Color from 'color';
const color = {
  name: 'color',
  syntax: 'm: color <COLOR>',
  explanation: 'Get info about a color',
  matcher: (cmd: Command) => cmd.command == 'color',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'color',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage, cmd: Command) => {
    if (cmd.command !== 'color') return;
    try {
      let canvas = Canvas.createCanvas(100, 100);
      let ctx = canvas.getContext('2d');

      ctx.fillStyle = Color(cmd.color).string();

      ctx.fillRect(0, 0, 500, 500);
      // Use helpful Attachment class structure to process the file for you
      let attachment: Discord.MessageAttachment = new Discord.MessageAttachment(
        canvas.toBuffer(),
        'image.png'
      );
      await msg.dbReply(
        new Discord.MessageEmbed()
          .setTitle(cmd.color)
          .addFields(
            {
              name: 'RGB',
              value: Color(cmd.color).rgb().string(),
              inline: false,
            },
            {
              name: 'Hex',
              value: Color(cmd.color).hex(),
              inline: false,
            },
            {
              name: 'HSL',
              value: Color(cmd.color).hsl(),
              inline: false,
            }
          )
          .attachFiles([attachment])
          .setImage('attachment://image.png')
      );
      // Run for each discord background color
      for (const color of ['#36393F', '#FFFFFF']) {
        canvas = Canvas.createCanvas(120, 40);
        ctx = canvas.getContext('2d');
        // Fill discord background color
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 200, 100);
        // Write username
        ctx.fillStyle = Color(cmd.color).string();
        ctx.font = 'Semibold 15px Whitney';
        ctx.fillText('Example User', 10, 27);
        // Use helpful Attachment class structure to process the file for you
        attachment = new Discord.MessageAttachment(
          canvas.toBuffer(),
          'image.png'
        );
        await msg.dbReply(
          new Discord.MessageEmbed()
            .attachFiles([attachment])
            .setImage('attachment://image.png')
        );
      }
    } catch (e) {
      msg.dbReply(e.toString());
    }
  },
};
const ping = {
  name: 'ping',
  syntax: 'm: ping',
  explanation: 'Ping the bot',
  matcher: (cmd: Command) => cmd.command == 'ping',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'ping',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage) => {
    await msg.dbReply(
      `Pong! Took ${new Date().getTime() - msg.createdAt.getTime()}ms`
    );
  },
};
const owo = {
  name: 'OwO',
  syntax: '!owo <ACTION> [USER]',
  explanation: 'Get a gif',
  matcher: (cmd: Command) => cmd.command == 'owo',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'owo',
  permissions: () => true && process.env.MEDIAGEN_URL,
  version: 2,
  responder: async (ctx: Types.Context, cmd: Types.Command) => {
    if (cmd.command !== 'owo') return;
    console.log(cmd.authee);
    const authee = cmd.authee
      ? ctx.msg.guild?.members.cache.get(cmd.authee)?.displayName
      : undefined;
    const data = await fetch(
      `${process.env.MEDIAGEN_URL}owoJson?action=${encodeURIComponent(
        cmd.action
      )}&author=${encodeURIComponent(ctx.msg.member?.displayName || '')}${
        authee ? '&authee=' + encodeURIComponent(authee) : ''
      }`
    );
    const dataJson = await data.json();
    if (data.status === 404)
      throw new util_functions.BotError(
        'user',
        'Action not found. Run `!help owo` to see all actions'
      );
    await ctx.msg.dbReply(
      new Discord.MessageEmbed()
        .setAuthor(dataJson.authorName, ctx.msg.author.displayAvatarURL())
        .setImage(
          `${process.env.MEDIAGEN_URL}owoProxy.gif?url=${encodeURI(
            dataJson.imageURL
          )}`
        )
        .setColor('#bb42cc')
    );
  },
};
if (process.env.MEDIAGEN_URL)
  (async () => {
    try {
      owo.syntax =
        '!owo <' +
        (
          await (await fetch(process.env.MEDIAGEN_URL + 'owoActions')).json()
        ).join('/') +
        '> [USER]';
      setInterval(
        async () =>
          (owo.syntax =
            '!owo <' +
            (
              await (
                await fetch(process.env.MEDIAGEN_URL + 'owoActions')
              ).json()
            ).join('/') +
            '> [USER]'),
        1000 * 60 * 60 // One Hour
      );
    } catch (e) {}
  })();
const average = require('average');
const about = {
  name: 'about',
  syntax: 'm: about',
  explanation: 'Get bot info',
  version: 2,
  matcher: (cmd: Command) => cmd.command == 'about',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'about',
  permissions: () => true,
  responder: async (ctx: Types.Context) => {
    let pj;
    try {
      pj = require('../package.json').version;
    } catch (e) {
      pj = '?.?.?';
    }
    await ctx.msg.dbReply(
      new Discord.MessageEmbed()
        .setTitle('About ModBot')
        .setDescription(
          `ModBot v${pj} is in ${
            ctx.client.guilds.cache.array().length
          } servers, with ${
            ctx.client.channels.cache
              .array()
              .filter((channel) => channel.type === 'text').length
          } channels, and ${ctx.client.users.cache.array().length} users.${
            (ctx.msg.guild as EGuild).hasPluralKit
              ? ' ModBot is designed to work well with PluralKit.'
              : ''
          } ModBot was last restarted ${moment
            .duration(process.uptime() * -1000)
            .humanize(true)}.${
            ctx.store.get('stats.msgResponseTimes')
              ? ` The average time it takes ModBot to reply to a command is ${Math.round(
                  average(ctx.store.get('stats.msgResponseTimes'))
                )}ms`
              : ''
          }`
        )
        .setFooter(
          process.env.AUTHOR_NAME
            ? 'Made with ❤️ by ' + process.env.AUTHOR_NAME
            : 'Made with ❤️'
        )
    );
  },
};
const addemoji = {
  name: 'addemoji',
  syntax: 'm: addemoji <NAME> <EMOJI/URL/ATTACH A FILE>',
  explanation:
    'Add a new server emoji. Either supply an emoji to steal, a url of an image, or attach an image to the command message',
  matcher: (cmd: Command) => cmd.command === 'addemoji',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'addemoji',
  permissions: (msg: util_functions.EMessage) =>
    msg.member?.hasPermission('MANAGE_EMOJIS'),
  responder: async (msg: util_functions.EMessage, cmd: Command) => {
    if (!msg.guild) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_EMOJIS']);
    if (cmd.command !== 'addemoji' || !msg.guild) return;
    let emojiUrl = undefined;
    if (/<:.*:(\d+)>/.test(cmd.emojiData || '')) {
      emojiUrl =
        'https://cdn.discordapp.com/emojis/' +
        (cmd.emojiData || '').match(/<:.*:(\d+)>/)?.[1] +
        '.png';
    } else if (/<a:.*:(\d+)>/.test(cmd.emojiData || '')) {
      emojiUrl =
        'https://cdn.discordapp.com/emojis/' +
        (cmd.emojiData || '').match(/<a:.*:(\d+)>/)?.[1] +
        '.gif';
    } else if (msg.attachments.array().length)
      emojiUrl = msg.attachments.array()[0].url;
    else if (cmd.emojiData) emojiUrl = cmd.emojiData;
    if (!emojiUrl)
      throw new util_functions.BotError(
        'user',
        "You don't seem to have supplied me an image"
      );
    try {
      const addedEmoji = await msg.guild.emojis.create(emojiUrl, cmd.name, {});
      await msg.dbReply(`Added ${addedEmoji} with name ${addedEmoji.name}`);
    } catch (e) {
      await msg.dbReply('Failed\n' + e);
    }
  },
};
async function designEmbed(
  msg: util_functions.EMessage,
  embed?: Discord.MessageEmbed
): Promise<Discord.MessageEmbed> {
  let currEmbed = embed || new Discord.MessageEmbed();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await msg.channel.send('Current Embed:', currEmbed);
    } catch (e) {
      msg.channel.send('Invalid data provided, embed reset');
      currEmbed = embed || new Discord.MessageEmbed();
      await msg.channel.send('Current Embed:', currEmbed);
    }
    await msg.channel.send('Options:');
    const change = await util_functions.embed_options(
      'What do you want to change?',
      [
        'Finish and Save',
        'Title',
        'Description',
        'Color',
        'Footer',
        'Image',
        'Link',
        'Clear All',
        'Author',
        'Add Field',
        'Edit Field',
      ],
      ['💾', '🎟️', '📝', '🟩', '🦶', '🖼️', '🔗', '🆑', '😀', '➕', '✏️'],
      msg,
      80000
    );
    if (change === 0) return currEmbed;
    if (change === null)
      throw new util_functions.BotError('user', 'Timed out, embed not saved');
    if (change === 1)
      currEmbed.setTitle(
        await util_functions.ask('What should the title be?', 60000, msg)
      );
    if (change === 2)
      currEmbed.setDescription(
        await util_functions.ask('What should the description be?', 60000, msg)
      );
    if (change === 3)
      currEmbed.setColor(
        await util_functions.ask('What should the color be?', 60000, msg)
      );
    if (change === 4)
      currEmbed.setFooter(
        await util_functions.ask('What should the footer be?', 60000, msg)
      );
    if (change === 5)
      currEmbed.setImage(
        await util_functions.ask(
          'What should the URL of the image be?',
          80000,
          msg
        )
      );
    if (change === 6)
      currEmbed.setURL(
        await util_functions.ask(
          'What URL should the embed link to?',
          80000,
          msg
        )
      );

    if (change === 7) currEmbed = new Discord.MessageEmbed();
    if (change === 8)
      currEmbed.setAuthor(
        await util_functions.ask(
          'What should the name of the author be?',
          80000,
          msg
        )
      );
    if (change === 9)
      currEmbed.addField(
        await util_functions.ask(
          'What should the name of the field be?',
          80000,
          msg
        ),
        await util_functions.ask(
          'What should the content of the field be?',
          80000,
          msg
        )
      );
    if (change === 10)
      if (
        await util_functions.embed_options(
          'What do you want to change?',
          ['Delete', 'Edit'],
          ['🗑️', '✏️'],
          msg,
          40000
        )
      )
        currEmbed.spliceFields(
          parseInt(
            await util_functions.ask('Which embed (by number)?', 60000, msg)
          ) - 1,
          1,
          {
            name: await util_functions.ask(
              'What should the name of the field be?',
              80000,
              msg
            ),
            value: await util_functions.ask(
              'What should the content of the field be?',
              80000,
              msg
            ),
          }
        );
      else
        currEmbed.spliceFields(
          parseInt(
            await util_functions.ask('Which embed (by number)?', 80000, msg)
          ) - 1,
          1
        );
  }
}
const embed = {
  name: 'embed',
  syntax: 'm: embed <create/edit>',
  explanation: 'Create/Edit a custom embed',
  matcher: (cmd: Command) => cmd.command == 'embed',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'embed',
  permissions: (msg: util_functions.EMessage) =>
    msg.member?.hasPermission('MANAGE_MESSAGES'),
  responder: async (msg: util_functions.EMessage, cmd: Command) => {
    if (cmd.command !== 'embed' || !msg.guild) return;
    if (cmd.action == 'create') {
      const channel = await util_functions.ask('What channel?', 40000, msg);
      const dChannel = msg.guild.channels.cache.get(
        channel.replace('<#', '').replace('>', '')
      );
      if (!dChannel || dChannel.type !== 'text')
        throw new util_functions.BotError('user', 'Failed to get channel');
      await (dChannel as Discord.TextChannel).send(await designEmbed(msg));
      await msg.channel.send('Sent!');
    }
    if (cmd.action == 'edit') {
      const channel = await util_functions.ask('What channel?', 40000, msg);
      const dChannel = msg.guild.channels.cache.get(
        channel.replace('<#', '').replace('>', '')
      );
      if (!dChannel || dChannel.type !== 'text')
        throw new util_functions.BotError('user', 'Failed to get channel');
      const m = await util_functions.ask('What messsage ID?', 40000, msg);
      const dMessage = await (dChannel as Discord.TextChannel).messages.fetch(
        m
      );
      if (!dMessage)
        throw new util_functions.BotError('user', 'Failed to get channel');
      await dMessage.edit(await designEmbed(msg, dMessage.embeds[0]));
      await msg.channel.send('Edited!');
    }
  },
};
/*
const update_cmd = {
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
};*/
const cat = {
  name: 'cat',
  syntax: 'm: cat',
  explanation: 'By special request, a photo of a cat',
  matcher: (cmd: Command) => cmd.command == 'cat',
  simplematcher: (cmd: Array<string>) => cmd[0] === 'cat',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage) => {
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

    const message = (await (await fetch('https://catfact.ninja/fact')).json())
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
    await msg.dbReply(attachment);
  },
};
exports.commandModule = {
  title: 'Utilities',
  description: 'Helpful utility commands',
  commands: [
    invite,
    userpic,
    ping,
    cat,
    about,
    owo,
    poll,
    suggestion,
    color,
    prefix,
    embed,
    addemoji,
    spoil,
    pick,
  ],
};
function getLines(
  ctx: Canvas.CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const words = text.split(' ');
  const lines: Array<string> = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
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
