/* eslint-disable no-empty */
import * as util_functions from '../util_functions';
import * as Utils from '../util_functions';
import moment from 'moment';
import Discord, {
  ColorResolvable,
  GuildEmoji,
  MessageReaction,
  Snowflake,
  User,
} from 'discord.js';
import { EGuild, Prefix, Context } from '../types';
import * as Types from '../types';
import { Defer } from '../defer';
import Canvas from 'canvas';
import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import mi from 'markdown-it';
import MDTT from 'mdtt';
import path from 'path';
const serviceKey = path.join(__dirname, './keys.json');
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

const storage = new Storage();

function stripIndent(text: string, indent: string): string {
  return text
    .split('\n')
    .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
    .join('\n');
}
// Get bot invite link
const invite = {
  name: 'invite',
  syntax: 'invite',
  explanation: util_functions.fillStringVars('Get a __botName__ server invite'),
  permissions: () => true,
  version: 2,
  responder: async (ctx: Context) => {
    await ctx.msg.dbReply({
      embeds: [
        new Discord.MessageEmbed()
          .setURL(
            `https://discord.com/api/oauth2/authorize?client_id=${ctx.client.user?.id}&permissions=2146958847&scope=bot`
          )
          .setTitle('Click here to invite ModBot to your server')
          .setDescription(
            'Thank you for using ModBot! <:pOg:759186176094765057>'
          )
          .setColor('#9168a6')
          .setFooter(
            process.env.AUTHOR_NAME
              ? 'Made with ❤️ by ' + process.env.AUTHOR_NAME
              : 'Made with ❤️'
          ),
      ],
    });
  },
};
// Edit a poll message with an updated image
async function reRenderPoll(message: Discord.Message | Discord.PartialMessage) {
  try {
    await message.edit({
      embeds: [
        message.embeds[0].setImage(
          new Types.MediaGen().generatePoll({
            up:
              (message.reactions.cache
                .array()
                .filter((r) => r.emoji.name == '👍')[0].count || 1) - 1,
            down:
              (message.reactions.cache
                .array()
                .filter((r) => r.emoji.name == '👎')[0].count || 1) - 1,
          })
        ),
      ],
    });
  } catch (e) {
    console.log(e);
  }
}
const poll = {
  name: 'poll',
  syntax: 'poll <text: string>',
  explanation: 'Run a yes/no poll',
  permissions: () => Types.MediaGen.enabled,
  responder: async (msg: util_functions.EMessage, cmd: { text: string }) => {
    util_functions.warnIfNoPerms(msg, ['MANAGE_MESSAGES']);
    await new Types.MediaGen().assert();
    try {
      await msg.delete();
    } catch (e) {}
    // Show warning
    const pollMsg = await msg.channel.send({
      embeds: [
        new Discord.MessageEmbed()
          .setTitle('Photosensitive Epilepsy Warning')
          .setDescription(
            'Poll can flash when votes are rapidly submitted. Accept to continue'
          )
          .setColor(util_functions.COLORS.error),
      ],
      components: [
        new Discord.MessageActionRow().addComponents(
          new Discord.MessageButton()
            .setCustomId('accept')
            .setLabel('Accept')
            .setStyle('DANGER')
        ),
      ],
    });
    // Wait for confirmation
    const react = await util_functions.awaitMessageComponentByAuthor(pollMsg, {
      time: 50000,
      author: msg.author.id,
    });
    // If confirmation given
    if (react) {
      await react.deferUpdate();
      // Edit confirmation message into poll
      await pollMsg.edit({
        embeds: [
          new Discord.MessageEmbed()
            .setAuthor(
              msg.member?.displayName || msg.author.username,
              msg.author.displayAvatarURL()
            )
            .setTitle(cmd.text)
            .setImage(new Types.MediaGen().generatePoll({ up: 0, down: 0 })),
        ],
        components: [],
      });
      // Add reactions for voting
      await pollMsg.react('👍');
      await pollMsg.react('👎');
      // Save poll in database
      await Types.Poll.query().insert({ message: pollMsg.id });
    } else {
      await pollMsg.edit({
        embeds: [
          new Discord.MessageEmbed()
            .setTitle('Epilepsy Warning Not Accepted')
            .setColor(util_functions.COLORS.error),
        ],
        components: [],
      });
    }
  },
};
const spoil = {
  name: 'spoil',
  syntax: 'spoil/spoiler <text: string>',
  explanation: 'Repost message with all attachments spoilered',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage, cmd: { text: string }) => {
    if (!msg.guild) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_MESSAGES']);
    if (
      msg.guild !== null &&
      (msg.channel.type == 'GUILD_TEXT' ||
        msg.channel.type == 'GUILD_PUBLIC_THREAD' ||
        msg.channel.type == 'GUILD_PRIVATE_THREAD')
    ) {
      const uuser = msg.member;
      if (!uuser) throw new Error('User not found');
      // Create a webhook for sending message
      let loghook;
      if (
        (msg.channel.type == 'GUILD_PUBLIC_THREAD' ||
          msg.channel.type == 'GUILD_PRIVATE_THREAD') &&
        msg.channel.parent
      )
        loghook = await msg.channel.parent.createWebhook(uuser.displayName, {
          avatar: uuser.user.displayAvatarURL().replace('webp', 'png'),
        });
      else if (msg.channel.type == 'GUILD_TEXT')
        loghook = await msg.channel.createWebhook(uuser.displayName, {
          avatar: uuser.user.displayAvatarURL().replace('webp', 'png'),
        });
      else throw new util_functions.BotError('bot', 'Internal error');
      // Add SPOILER_ to all message attachments to make them be spoiled
      const files = msg.attachments.array().map((attachment) => {
        return { ...attachment, name: 'SPOILER_' + attachment.name };
      });
      // Send with a webhook for custom username and profile picture
      const m = await loghook.send({
        files,
        content: await util_functions.cleanPings(cmd.text, msg.guild),
        ...(msg.channel.isThread() ? { threadId: msg.channel.id } : {}),
      });
      // Delete webhook
      await loghook.delete();
      await Types.LogChannel.tryToLog(
        msg,
        `Re-sent message with spoil command: [Re-sent Message](${
          (m as Discord.Message).url
        })`
      );
    }
    try {
      await msg.delete();
    } catch (e) {}
  },
};
const pfp = {
  name: 'pfp',
  syntax: 'pfp <user: user_id>',
  explanation: "Get a user's profile picture",
  permissions: () => true,
  version: 2,
  responder: async (ctx: Types.Context, cmd: { user: string }) => {
    if (!ctx.msg.guild) return;
    let user;
    try {
      user = await ctx.client.users.fetch(cmd.user as Snowflake);
    } catch (e) {
      throw new util_functions.BotError('user', 'User not found');
    }
    const member = ctx.msg.guild.members.cache.get(cmd.user as Snowflake);
    if (!user) throw new util_functions.BotError('user', 'User not found');
    await ctx.msg.dbReply({
      embeds: [
        new Discord.MessageEmbed()
          .setTitle(
            `${member ? member.displayName : user.username}'s Profile Picture`
          )
          .setImage(user.displayAvatarURL() + '?size=256')
          .setColor(util_functions.COLORS.decorate),
      ],
    });
  },
};
const pick = {
  name: 'pick',
  syntax: 'pick <items: string>',
  explanation: 'Pick a random item from a list of options, seperated by `;`',
  version: 2,
  permissions: () => true,
  responder: async (ctx: Types.Context, cmd: { items: string }) => {
    if (!ctx.msg.guild) return;
    ctx.msg.dbReply(
      `I choose ${await util_functions.cleanPings(
        util_functions.randArrayItem(
          cmd.items.split('; ').join(';').split(';')
        ),
        ctx.msg.guild
      )}`
    );
  },
};
function markdownifyDiscordFormatting(
  input: string,
  client: Discord.Client,
  m: (strings: TemplateStringsArray, ...values: any[]) => string
): string {
  return (
    input
      .replaceAll(/&lt;@\\?!?(\d+)&gt;/g, (match, id) => {
        return client.users.cache.get(id)
          ? m`<a class="mention" href="https://discordapp.com/users/${id}">@${
              client.users.cache.get(id)?.tag
            }</a>`
          : m`<@${id}>`;
      })
      /*.replaceAll(/&lt;@&amp;(\d+)\\?&gt;/g, (match, group1) => {
      return client.guilds.cache.get(group1)
        ? m`<span class="mention">@${
            client.roles.cache.get(group1)?.tag
          }</span>`
        : m`<@${group1}>`;
    })*/
      .replaceAll(/&lt;\\?#(\d+)&gt;/g, (match, id) => {
        const channel = client.channels.cache.get(id) as Discord.TextChannel;
        return channel
          ? m`<a class="mention" href="https://discord.com/channels/${channel.guild.id}/${channel.id}">#${channel.name}</a>`
          : m`<#${id}>`;
      })
      .replaceAll(/&lt;(a?):(\w+):(\d+)&gt;/g, (match, animatedA, name, id) => {
        const animated = animatedA == 'a';
        return m`<img alt="${name}" src="https://cdn.discordapp.com/emojis/${id}.${
          animated ? 'gif' : 'png'
        }" class="emoji"></img>`;
      })
  );
}
const datapack = {
  name: 'datapack',
  syntax: 'datapack',
  explanation:
    'Creates a datapack with all the information ModBot has on your account',
  permissions: () => true,
  version: 2,
  responder: async (ctx: Types.Context) => {
    ctx.msg.dbReply('Gathering data...');
    const anonbans = await prisma.anonbans.findMany({
      where: {
        user: ctx.msg.author.id,
      },
    });
    const anonmessages = await prisma.anonmessages.count({
      where: {
        user: ctx.msg.author.id,
      },
    });
    const capabilities = await prisma.capabilities.findMany({
      where: {
        user: ctx.msg.author.id,
      },
    });
    const notesCount = await prisma.notes.count({
      where: {
        user: ctx.msg.author.id,
        type: 'note',
      },
    });
    const warns = await prisma.notes.findMany({
      where: {
        user: ctx.msg.author.id,
        type: 'warn',
      },
    });
    const reminderSubscribers = await prisma.reminderSubscribers.findMany({
      where: {
        user: ctx.msg.author.id,
      },
    });
    const reminders = await prisma.reminders.findMany({
      where: {
        author: ctx.msg.author.id,
      },
    });
    const slowmodedUsers = await prisma.slowmoded_users.findMany({
      where: {
        user: ctx.msg.author.id,
      },
    });
    await ctx.msg.dbReply('Generating datapack...');
    const m = MDTT({
      sanitizeHtml: true,
    });
    const markdown = stripIndent(
      m`
    # ${ctx.msg.author.username}'s Data Pack
    
    This file contains all of the currently accessible data that ModBot has about your user account. Please keep in mind that some deleted data may still be stored in database backups, and some information may be private and cannot be shared in this document.
    
    ## Anon Bans
    ModBot stores this information when your account is banned from an anonymous channel, to enforce the ban. ModBot stores your user ID and the ID of the server you have been anonbanned from. They are presented here as a list of server names.

    ${anonbans.map(
      (n: any) =>
        m`* ${
          ctx.client.guilds.cache.get(n.server as Snowflake) ||
          { name: n.server }.name
        }\n`
    )}
    ${anonbans.length == 0 ? m`*Empty*` : ''}

    ## Anon Messages
    ModBot stores the ID of every message you send in an anon channel, along with your user ID and the ID of the server the message was sent in. This is done to allow moderators to enforce rules within anon channels. ModBot has stored the IDs of ${anonmessages} anonmessages sent by your account.
    
    ## Capabilities
    ModBot stores various randomly generated tokens, along with your user ID, the permission given by the token, and when the token expires. These are used to generate one-time links to ModBot websites, such as the reminder dashboard.
    ${capabilities.map((n: any) => m`* \`${n.token}\`: ${n.type}\n`)}
    ${capabilities.length == 0 ? m`*Empty*` : ''}

    ## Notes and Warns
    When your account recieves a note or a warn from moderators, the message is stored along with your user ID and the ID of the server the note was sent in. Notes are private to server moderators, and cannot be shared here. You have recieved ${notesCount} total notes. Warns are presented here as a message and a server name.
    
    ${warns.map(
      (n: any) =>
        m`* *"${n.message}"*, ${
          ctx.client.guilds.cache.get(n.server as Snowflake) ||
          { name: m`\`${n.server}\`` }.name
        }\n`
    )}
    ${warns.length == 0 ? m`*Empty*` : ''}

    ## Reminder Subscribers
    When you choose to copy a reminder, ModBot stores you as a "subscriber" to that reminder. ModBot stores your user ID along with the ID of the reminder you have subscribed to. They are presented here as a list of reminder IDs.
    ${reminderSubscribers.map((n: any) => m`* \`${n.id}\`\n`)}
    ${reminderSubscribers.length == 0 ? m`*Empty*` : ''}

    # Reminders
    When you create a reminder, ModBot stores your user ID, the reminder ID, the reminder text, and when the reminder is due.
    ${reminders.map((n: any) => m`* \`${n.id}\`: *"${n.text}"*\n`)}
    ${reminders.length == 0 ? m`*Empty*` : ''}

    ## Slowmodes
    When you send a message in a channel that has a bot enforced slowmode enabled, the bot stores your user ID and the channel ID, so the bot can give back your message permissions once the slowmode expires.
    
    ${slowmodedUsers.map(
      (n: any) =>
        m`* ${
          ctx.client.channels.cache.get(n.channel as Snowflake) ||
          { name: m`\`${n.channel}\`` }.name
        }\n`
    )}
    ${slowmodedUsers.length == 0 ? m`*Empty*` : ''}
    `,
      '    '
    );
    const styles = stripIndent(
      `
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://twemoji.maxcdn.com/v/latest/twemoji.min.js" crossorigin="anonymous"></script>
    <script>twemoji.parse(document.body, { ext: ".svg", folder: 'svg' });</script>
    <style>
      a, a:visited {
        color: #4e82ff;
        text-decoration: none;
      }
      .mention {
        border-radius: 5px;
        background: #e7e7ff;
        font-weight: bold;
        color: black !important;
      }
      code {
        font-family: monospace;
        background: #e6e6e6;
        padding: 2px;
        border-radius: 5px;
      }
      * {
        font-family: "system-ui", sans-serif;
      }
      body {
        max-width: 800px;
        padding: 15px;
      }
      img.emoji {
        height: 1.2em;
        width: 1.2em;
        margin: 0 .05em 0 .1em;
        vertical-align: -0.25em;
     }
    </style>
    `,
      '    '
    );
    const md = mi({
      html: true,
      linkify: true,
    });
    const html =
      md.render(markdownifyDiscordFormatting(markdown, ctx.client, m)) +
      '\n' +
      styles;
    await ctx.msg.dbReply('Datapack ready, DMing you now');
    const fileName = uuidv4() + '.html';
    await storage
      .bucket(process.env.BUCKET_NAME || '')
      .file(fileName)
      .save(html, {
        contentType: 'text/html; charset=utf-8',
      });

    try {
      await (
        await ctx.msg.author.createDM()
      ).send(`https://datapacks.xyz/${fileName}`);
    } catch (e) {
      throw new util_functions.BotError(
        'user',
        'Cannot DM you, check your privacy settings.'
      );
    }
  },
};
const suggestion = {
  name: 'suggestion',
  syntax: 'suggestion',
  explanation: 'Submit a suggestion to ModBot',
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
      // Make a REST POST to the SuggestionManager API
      const realAPIURL = process.env.SUGGESTIONMANAGER_URL.endsWith('/')
        ? process.env.SUGGESTIONMANAGER_URL
        : `${process.env.SUGGESTIONMANAGER_URL}/`;
      const token: { projectId: string } = (await (
        await fetch(
          `${realAPIURL}tokens/${process.env.SUGGESTIONMANAGER_TOKEN}`
        )
      ).json()) as { projectId: string };
      const res = await fetch(
        `${realAPIURL}projects/${token.projectId}/suggestions`,
        {
          headers: {
            Authorization: `Bearer ${process.env.SUGGESTIONMANAGER_TOKEN}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            displayName: sn.padEnd(3), // To ensure username meets the minimum length limit for SuggestionManager
            suggestionText: st,
          }),
        }
      );
      if (res.status !== 200) {
        throw new util_functions.BotError(
          'user',
          'Failed to submit suggestion. This is probably not your fault!'
        );
      } else
        await msg.dbReply(
          'Submitted, thank you! You can also submit suggestions at https://suggestionmanager.com/suggest/a621c969-5028-44f5-8482-74467e509639/'
        );
    }
  },
};
const prefix = {
  name: 'prefix',
  syntax: 'prefix <action: "add" | "remove">',
  explanation: 'Change bot prefixes',
  permissions: (msg: util_functions.EMessage) =>
    msg.member?.permissions.has('MANAGE_MESSAGES'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: { action: 'add' | 'remove' }
  ) => {
    if (!msg.guild) return;

    if (cmd.action == 'add') {
      const prefix = await util_functions.ask(
        'What should the prefix be?',
        20000,
        msg
      );
      if (prefix === process.env.BOT_PREFIX)
        throw new util_functions.BotError('user', 'Prefix already registered');
      if (prefix.length > 5)
        throw new util_functions.BotError('user', 'Prefix is too long');
      try {
        await Prefix.query().insert({ server: msg.guild.id, prefix });
        await msg.dbReply('Added!');
        await Types.LogChannel.tryToLog(
          msg,
          `Added ModBot prefix \`${prefix}\``
        );
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
      if (prefix === process.env.BOT_PREFIX)
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
        await Types.LogChannel.tryToLog(
          msg,
          `Removed ModBot prefix \`${prefix}\``
        );
      } catch (e) {
        await msg.dbReply('Failed to remove prefix');
      }
    }
  },
};
const prefixlist = {
  name: 'prefix',
  syntax: 'prefix list',
  explanation: 'List bot prefixes',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage) => {
    if (!msg.guild) return;
    msg.dbReply(
      util_functions.desc_embed(
        [
          ...(await Prefix.query().where('server', msg.guild.id)),
          { server: msg.guild.id, prefix: process.env.BOT_PREFIX } as Prefix,
        ]
          .map((p: Prefix) => `\`${p.prefix}\``)
          .join('\n')
      )
    );
  },
};
const userpic = {
  name: 'userpic',
  syntax: 'userpic',
  explanation: 'Get a nice message',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage) => {
    msg.channel.sendTyping();
    const canvas = Canvas.createCanvas(700, 250);
    const ctx = canvas.getContext('2d');
    // Load random background image
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
    const message = get_random(messages);
    const size = 1100 / message.length;
    ctx.font = size + 'px Consolas';
    ctx.fillText(message, canvas.width / 2, canvas.height / 1.8);
    // Use helpful Attachment class structure to process the file for you
    const attachment = new Discord.MessageAttachment(
      canvas.toBuffer(),
      'image.png'
    );
    msg.dbReply({ files: [attachment] });
  },
};
import Color from 'color';
const color = {
  name: 'color',
  syntax: 'color/colour <color: string>',
  explanation: 'Get info about a color',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage, cmd: { color: string }) => {
    try {
      let canvas = Canvas.createCanvas(100, 100);
      let ctx = canvas.getContext('2d');

      ctx.fillStyle = Color(cmd.color).string();
      // Generate thumbnail of image color
      ctx.fillRect(0, 0, 500, 500);
      // Use helpful Attachment class structure to process the file for you
      let attachment: Discord.MessageAttachment = new Discord.MessageAttachment(
        canvas.toBuffer(),
        'image.png'
      );
      await msg.dbReply({
        embeds: [
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
                value: Color(cmd.color).hsl().string(),
                inline: false,
              }
            )
            .setThumbnail('attachment://image.png'),
        ],
        files: [attachment],
      });
      const colors = ['#FFFFFF', '#36393F', '#000000'];
      let i = 0;
      canvas = Canvas.createCanvas(120, colors.length * 40);
      ctx = canvas.getContext('2d');
      for (const color of colors) {
        // Fill discord background color
        ctx.fillStyle = color;
        ctx.fillRect(0, i * 40, 200, 100);
        // Write username in color
        ctx.fillStyle = Color(cmd.color).string();
        ctx.font = 'Semibold 15px Whitney';
        ctx.fillText('Example User', 10, 25 + i * 40);
        i++;
      }
      attachment = new Discord.MessageAttachment(
        canvas.toBuffer(),
        'image.png'
      );
      await msg.dbReply({
        embeds: [
          new Discord.MessageEmbed()
            .setImage('attachment://image.png')
            .setTitle('Role Color Test'),
        ],
        files: [attachment],
      });
    } catch (e) {
      msg.dbReply(e.toString());
    }
  },
};
const ping = {
  name: 'ping',
  syntax: 'ping',
  explanation: 'Ping the bot',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage) => {
    await msg.dbReply(
      `Pong! Took ${new Date().getTime() - msg.createdAt.getTime()}ms`
    );
  },
};
const owo = {
  name: 'OwO',
  syntax: 'owo <action: word> [user: user_id]',
  explanation: 'Get a gif',
  permissions: () => Types.MediaGen.enabled,
  version: 2,
  responder: async (
    ctx: Types.Context,
    cmd: { action: string; user: string }
  ) => {
    await new Types.MediaGen().assert();
    // Get the tagged user, or none
    const authee = cmd.user
      ? ctx.msg.guild?.members.cache.get(cmd.user as Snowflake)?.displayName
      : undefined;
    // Get a message, image, and metadata from mediagen
    const data = await fetch(
      `${process.env.MEDIAGEN_URL}owoJson?action=${encodeURIComponent(
        cmd.action
      )}&author=${encodeURIComponent(ctx.msg.member?.displayName || '')}${
        authee ? '&authee=' + encodeURIComponent(authee) : ''
      }`
    );
    const dataJson = (await data.json()) as {
      authorName: string;
      imageURL: string;
      color: ColorResolvable;
    };
    if (data.status === 404)
      // 404 is returned on invalid actions
      throw new util_functions.BotError(
        'user',
        `Action not found. Run \`${ctx.prefix}help owo\` to see all actions`
      );
    await ctx.msg.dbReply({
      embeds: [
        new Discord.MessageEmbed()
          .setAuthor(dataJson.authorName, ctx.msg.author.displayAvatarURL())
          .setImage(
            // Use mediagen to resize and process gif
            `${process.env.MEDIAGEN_URL}owoProxy.gif?url=${encodeURIComponent(
              dataJson.imageURL
            )}`
          )
          // Set dominant color from mediagen
          .setColor(dataJson.color),
      ],
    });
  },
};
// TODO: Reimplement
/*
// If mediagen is setup, update syntax for OwO command to include all available actions in mediagen
if (Types.MediaGen.enabled)
  (async () => {
    try {
      owo.syntax =
        'm: owo <' +
        (await new Types.MediaGen().owoActions()).join('/') +
        '> [USER]';
      setInterval(
        async () =>
          (owo.syntax =
            'm: owo <' +
            (await new Types.MediaGen().owoActions()).join('/') +
            '> [USER]'),
        1000 * 60 * 60 // One Hour
      );
    } catch (e) {}
  })();*/
const average = require('average');
const about = {
  name: 'about',
  syntax: 'about',
  explanation: 'Get bot info',
  version: 2,
  permissions: () => true,
  responder: async (ctx: Types.Context) => {
    let pj;
    // Get version, or unknown if package.json doesn't exist (Might not exist during rebuilds)
    try {
      pj = require('../package.json').version;
    } catch (e) {
      pj = '?.?.?';
    }
    await ctx.msg.dbReply({
      embeds: [
        new Discord.MessageEmbed()
          .setTitle('About ModBot')
          .setDescription(
            `ModBot v${pj} is in ${
              ctx.client.guilds.cache.array().length
            } servers, with ${
              ctx.client.channels.cache
                .array()
                .filter((channel) => channel.type === 'GUILD_TEXT').length
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
          .setColor(util_functions.COLORS.decorate),
      ],
    });
  },
};
const url = require('url');
const addemoji = {
  name: 'addemoji',
  syntax: 'addemoji <name: word> [emojiData: string]',
  explanation:
    'Add a new server emoji. Either supply an emoji to steal, a url of an image, or attach an image to the command message',
  permissions: (msg: util_functions.EMessage) =>
    msg.member?.permissions.has('MANAGE_EMOJIS_AND_STICKERS'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: { emojiData: string | undefined; name: string }
  ) => {
    if (!msg.guild) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_EMOJIS_AND_STICKERS']);
    await new Types.MediaGen().assert();
    if (!msg.guild) return;

    let emojiUrl = undefined;
    if (/<:.*:(\d+)>/.test(cmd.emojiData || '')) {
      // If non-animated emoji is supplied
      emojiUrl =
        'https://cdn.discordapp.com/emojis/' +
        (cmd.emojiData || '').match(/<:.*:(\d+)>/)?.[1] +
        '.png';
    } else if (/<a:.*:(\d+)>/.test(cmd.emojiData || '')) {
      // If animated emoji is supplied
      emojiUrl =
        'https://cdn.discordapp.com/emojis/' +
        (cmd.emojiData || '').match(/<a:.*:(\d+)>/)?.[1] +
        '.gif';
    } else if (msg.attachments.array().length)
      // If an attachment is supplied, use that
      emojiUrl =
        process.env.MEDIAGEN_URL &&
        path.extname(url.parse(msg.attachments.array()[0].url).pathname) !==
          '.gif'
          ? process.env.MEDIAGEN_URL +
            'emojiResize.png?url=' +
            encodeURIComponent(msg.attachments.array()[0].url)
          : msg.attachments.array()[0].url;
    // Otherwise use whatever data was given (Probably an image URL)
    else if (cmd.emojiData)
      emojiUrl =
        process.env.MEDIAGEN_URL &&
        path.extname(url.parse(cmd.emojiData).pathname) !== '.gif'
          ? process.env.MEDIAGEN_URL +
            'emojiResize.png?url=' +
            encodeURIComponent(cmd.emojiData)
          : cmd.emojiData;
    if (!emojiUrl)
      throw new util_functions.BotError(
        'user',
        "You don't seem to have supplied me an image"
      );
    try {
      // Add emoji
      const addedEmoji = await msg.guild.emojis.create(emojiUrl, cmd.name, {});
      await msg.dbReply(`Added ${addedEmoji} with name ${addedEmoji.name}`);
      await Types.LogChannel.tryToLog(
        msg,
        `Added emoji ${addedEmoji} with name ${addedEmoji.name}`
      );
    } catch (e) {
      throw new util_functions.BotError(
        'user',
        e.toString().replace('DiscordAPIError: ', '')
      );
    }
  },
};
const removeemoji = {
  name: 'removeemoji',
  syntax: 'removeemoji <name: string>',
  explanation: 'Remove an emoji from a server',
  permissions: (msg: util_functions.EMessage) =>
    msg.member?.permissions.has('MANAGE_EMOJIS_AND_STICKERS'),
  responder: async (msg: util_functions.EMessage, cmd: { name: string }) => {
    if (!msg.guild) return;
    util_functions.assertHasPerms(msg.guild, ['MANAGE_EMOJIS_AND_STICKERS']);
    if (!msg.guild) return;

    // Find all emojis with the name specified by the user
    const matchingEmojis = msg.guild.emojis.cache
      .array()
      .filter(
        (e) =>
          e.name === cmd.name ||
          (cmd.name.match(/<a?:[^:]+:(\d+)>/) || [])[1] == e.id
      );

    // Create a variable for storing the final emoji that will be deleted
    let finalEmoji: GuildEmoji | undefined;

    // If there are no emojis with the specified name, throw an error
    if (matchingEmojis.length === 0)
      throw new util_functions.BotError(
        'user',
        'No emoji found with that name'
      );
    // If there's only a single emoji with that name, set it as the chosen emoji
    else if (matchingEmojis.length === 1) finalEmoji = matchingEmojis[0];
    else {
      // If there's multiple emoji with that name, send an embed that prompts the user to choose one
      const selectionMessage = await msg.dbReply({
        embeds: [
          new Discord.MessageEmbed()
            .setTitle('Choose Emoji')
            .setDescription(
              'Multiple emoji were found with that name. Please react with the chosen emoji'
            )
            .setColor(util_functions.COLORS.decorate),
        ],
      });

      // Add all emojis with the specified name as reactions to the prompt message, so the user can easily pick one
      for (const e of matchingEmojis) selectionMessage.react(e);

      // Wait for the user to select an emoji on the prompt message
      const chosenReactions = (
        await selectionMessage.awaitReactions({
          time: 30000,
          max: 1,
          filter: (r: MessageReaction, u: User) =>
            u.id === msg.author.id &&
            !!matchingEmojis.find((e) => e.id === r.emoji.id),
        })
      ).array();

      // If they didn't pick one, throw a timed out error
      if (chosenReactions.length === 0)
        throw new util_functions.BotError('user', 'Timed out');
      // If they picked one, set it as the final emoji
      else finalEmoji = chosenReactions[0].emoji as GuildEmoji;
    }

    // If somehow no emoji was chosen, return.
    // This shouldn't be possible
    if (!finalEmoji) return;

    // Delete the final chosen emoji
    await finalEmoji.delete();

    // Show a success message
    await msg.dbReply(
      util_functions.embed(`Removed \`:${finalEmoji.name}:\``, 'success')
    );

    // Log what was done
    await Types.LogChannel.tryToLog(
      msg,
      `Removed emoji \`:${finalEmoji.name}:\``
    );
  },
};
// UI flow to create embed
async function designEmbed(
  msg: util_functions.EMessage,
  embed?: Discord.MessageEmbed
): Promise<Discord.MessageEmbed> {
  let currEmbed = embed || new Discord.MessageEmbed();
  // Loop until user is done
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const tmpEmbed =
        currEmbed.description == null &&
        currEmbed.fields.length === 0 &&
        currEmbed.footer == null &&
        currEmbed.image == null &&
        currEmbed.title == null &&
        currEmbed.author == null
          ? new Discord.MessageEmbed().setDescription('*Empty Embed*')
          : currEmbed;
      await msg.channel.send({
        content: 'Current Embed:',
        embeds: [tmpEmbed],
      });
    } catch (e) {
      // User supplied an invalid option previously, and the embed can't be sent
      msg.channel.send('Invalid data provided, embed reset');
      // Reset the embed
      currEmbed = embed || new Discord.MessageEmbed();
      const tmpEmbed =
        currEmbed.description == null &&
        currEmbed.fields.length === 0 &&
        currEmbed.footer == null &&
        currEmbed.image == null &&
        currEmbed.title == null &&
        currEmbed.author == null
          ? new Discord.MessageEmbed().setDescription('*Empty Embed*')
          : currEmbed;
      await msg.channel.send({
        content: 'Current Embed:',
        embeds: [tmpEmbed],
      });
      console.error(e);
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
    // User chose to save
    if (change === 0) return currEmbed;
    // User chose nothing
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
        (await util_functions.ask(
          'What should the color be?',
          60000,
          msg
        )) as Discord.ColorResolvable
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
const setchannelname = {
  name: 'setchannelname',
  syntax: 'setchannelname <name: string>',
  explanation: "Set a channel's name",
  permissions: (msg: util_functions.EMessage) =>
    msg.member?.permissions.has('MANAGE_CHANNELS'),
  version: 2,
  responder: async (ctx: Types.Context, cmd: { name: string }) => {
    await (ctx.msg.channel as Discord.TextChannel).setName(cmd.name);
    await ctx.msg.dbReply(util_functions.embed('Set channel name!', 'success'));
    await Types.LogChannel.tryToLog(
      ctx.msg,
      `Set channel name in ${ctx.msg.channel}`
    );
  },
};
const randommember = {
  name: 'randommember',
  syntax: 'randommember [role: role]',
  explanation: 'Get a random member',
  permissions: () => true,
  version: 2,
  responder: async (
    ctx: Types.Context,
    cmd: { role: Discord.Role | undefined }
  ) => {
    let randomMember;
    if (cmd.role) randomMember = cmd.role.members.random();
    else randomMember = ctx.msg.guild?.members.cache.random();
    if (!randomMember)
      throw new util_functions.BotError(
        'user',
        "That role doesn't have any members"
      );
    await ctx.msg.dbReply(
      util_functions.embed(`<@${randomMember.id}>`, 'tip', 'Random Member')
    );
  },
};
const setservername = {
  name: 'setservername',
  syntax: 'setservername <name: string>',
  explanation: "Set the server's name",
  permissions: (msg: util_functions.EMessage) =>
    msg.member?.permissions.has('MANAGE_GUILD'),
  version: 2,
  responder: async (ctx: Types.Context, cmd: { name: string }) => {
    await ctx.msg.guild?.setName(cmd.name);
    await ctx.msg.dbReply(util_functions.embed('Set server name!', 'success'));
    await Types.LogChannel.tryToLog(ctx.msg, `Set server name to ${cmd.name}`);
  },
};
const embed = {
  name: 'embed',
  syntax: 'embed <action: "create" | "edit">',
  explanation: 'Create/Edit a custom embed',
  permissions: (msg: util_functions.EMessage) =>
    msg.member?.permissions.has('MANAGE_MESSAGES'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: { action: 'create' | 'edit' }
  ) => {
    if (!msg.guild) return;
    if (cmd.action == 'create') {
      const channel = await util_functions.ask('What channel?', 40000, msg);
      const dChannel = msg.guild.channels.cache.get(
        channel.replace('<#', '').replace('>', '') as Snowflake
      );
      if (!dChannel || dChannel.type !== 'GUILD_TEXT')
        throw new util_functions.BotError('user', 'Failed to get channel');
      await (dChannel as Discord.TextChannel).send({
        embeds: [await designEmbed(msg)],
      });
      await msg.channel.send('Sent!');
      await Types.LogChannel.tryToLog(
        msg,
        `Sent custom embed message in ${dChannel}`
      );
    }
    if (cmd.action == 'edit') {
      const channel = await util_functions.ask('What channel?', 40000, msg);
      const dChannel = msg.guild.channels.cache.get(
        channel.replace('<#', '').replace('>', '') as Snowflake
      );
      if (!dChannel || dChannel.type !== 'GUILD_TEXT')
        throw new util_functions.BotError('user', 'Failed to get channel');
      const m = await util_functions.ask('What messsage ID?', 40000, msg);
      const dMessage = await (dChannel as Discord.TextChannel).messages.fetch(
        m as Snowflake
      );
      if (!dMessage)
        throw new util_functions.BotError('user', 'Failed to get channel');
      await dMessage.edit({
        embeds: [await designEmbed(msg, dMessage.embeds[0])],
      });
      await msg.channel.send('Edited!');
      await Types.LogChannel.tryToLog(
        msg,
        `Edited custom embed message in ${dChannel}`
      );
    }
  },
};
const cat = {
  name: 'cat',
  syntax: 'cat',
  explanation: 'By special request, a photo of a cat',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage) => {
    try {
      const canvas = Canvas.createCanvas(600, 600);
      const ctx = canvas.getContext('2d');
      const background = await Canvas.loadImage('https://cataas.com/cat');
      // This uses the canvas dimensions to stretch the image onto the entire canvas
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, canvas.height / 1.4, 800, 500);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      // Add cat fact
      const message = (
        (await (await fetch('https://catfact.ninja/fact')).json()) as {
          fact: string;
        }
      ).fact;
      ctx.font = '20pt Consolas';
      ctx.fillText(
        getLines(ctx, message, 600).join('\n'),
        canvas.width / 2,
        canvas.height / 1.3
      );
      const attachment = new Discord.MessageAttachment(
        canvas.toBuffer(),
        'image.png'
      );
      await msg.dbReply({ files: [attachment] });
    } catch (e) {
      throw new util_functions.BotError(
        'user',
        `Failed to get cat image: ${e}`
      );
    }
  },
};
const git = require('git-rev-sync');
const waitforupdate = {
  name: 'waitforupdate',
  syntax: 'waitforupdate',
  explanation: 'Get pinged when the bot restarts',
  permissions: () => true,
  responder: async (msg: util_functions.EMessage) => {
    await msg.dbReply(
      Utils.embed('You will be pinged when the bot restarts!', 'success')
    );
    await Defer.add({
      type: 'SendMessage',
      channel: msg.channel.id,
      content: {
        content: msg.author.toString(),
        embeds: [
          new Discord.MessageEmbed()
            .setTitle('Bot Restarted')
            .setDescription(
              `ModBot is now on release \`${git.short()}\`\n> ${git.message()}`
            )
            .setColor('#24a7ff'),
        ],
      },
    });
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
    prefixlist,
    embed,
    addemoji,
    removeemoji,
    spoil,
    pick,
    pfp,
    setchannelname,
    setservername,
    waitforupdate,
    randommember,
    datapack,
  ],
  cog: async (client: Discord.Client) => {
    client.on('messageReactionAdd', async (reaction, user) => {
      const message = reaction.message as util_functions.EMessage;
      if (user.id === client.user?.id) return;
      try {
        // When we receive a reaction we check if the reaction is partial or not
        if (reaction.partial) {
          // If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
          try {
            await reaction.fetch();
          } catch (error) {
            console.log(
              'Something went wrong when fetching the message: ',
              error
            );
            // Return as `reaction.message.author` may be undefined/null
            return;
          }
        }
        if (!reaction.message.guild) return;
        if (
          (reaction.emoji.name == '👍' || reaction.emoji.name == '👎') &&
          (await message.isPoll())
        ) {
          // This is a poll and somebody reacted with poll emojis
          // Get other poll emojis on this message by user
          const t = reaction.message.reactions.cache
            .array()
            .filter(
              (r) =>
                (r.emoji.name == '👍' || r.emoji.name == '👎') &&
                r.users.cache.array().filter((u) => u.id == user.id).length &&
                r.emoji.name != reaction.emoji.name
            );
          // If the user has already voted, don't let them add another
          if (t.length) reaction.users.remove(user as Discord.User);
          else await reRenderPoll(reaction.message);
        }
      } catch (e) {}
    });
    client.on('messageReactionRemove', async (reaction, user) => {
      const message = reaction.message as util_functions.EMessage;
      if (user.id === client.user?.id) return;
      try {
        // When we receive a reaction we check if the reaction is partial or not
        if (reaction.partial) {
          // If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
          try {
            await reaction.fetch();
          } catch (error) {
            console.log(
              'Something went wrong when fetching the message: ',
              error
            );
            // Return as `reaction.message.author` may be undefined/null
            return;
          }
        }
        if (!reaction.message.guild) return;
        if (
          (reaction.emoji.name == '👍' || reaction.emoji.name == '👎') &&
          message.isPoll
        ) {
          // A user removed a poll react
          // Ensure the emoji wasn't removed by ModBot because it was a duplicate
          const t = reaction.message.reactions.cache
            .array()
            .filter(
              (r) =>
                (r.emoji.name == '👍' || r.emoji.name == '👎') &&
                r.users.cache.array().filter((u) => u.id == user.id).length &&
                r.emoji.name != reaction.emoji.name
            );
          if (!t.length) await reRenderPoll(reaction.message);
        }
      } catch (e) {}
    });
  },
};
// Convert text to array of lines for canvas
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
