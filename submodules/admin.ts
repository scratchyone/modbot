/* eslint-disable @typescript-eslint/no-var-requires */
import * as util_functions from '../util_functions';
import Discord, { Snowflake } from 'discord.js';
import { mintCapabilityToken } from '../web';
import * as Types from '../types';
import { generateCommandString } from '@scratchyone/command_parser';

const announce = {
  name: 'announce',
  syntax: 'announce',
  explanation: 'Send an announcement to all alertchannels',
  permissions: (msg: Discord.Message) => msg.author.id === '234020040830091265',
  responder: async (
    msg: util_functions.EMessage,
    cmd: Record<string, never>,
    client: Discord.Client
  ) => {
    if (!msg.guild) return;
    if (!client.user) return;
    if (!msg.member) return;
    const an_text = await util_functions.ask(
      'What should the announcement text be?',
      70000,
      msg
    );
    for (const alertchannel of await Types.AlertChannel.query()) {
      const ralertchannel = client.channels.cache.get(
        alertchannel.channel as Snowflake
      );
      if (!ralertchannel || ralertchannel.type !== 'GUILD_TEXT') continue;
      await (ralertchannel as Discord.TextChannel).send({
        embeds: [
          new Discord.MessageEmbed()
            .setTitle('Announcement')
            .setDescription(an_text),
        ],
      });
    }
    await msg.dbReply('Sent!');
  },
};
const admin = {
  name: 'admin',
  syntax: 'admin',
  explanation: "Wouldn't you like to know",
  permissions: (msg: Discord.Message) => msg.author.id === '234020040830091265',
  responder: async (msg: util_functions.EMessage) => {
    await (
      await msg.author.createDM()
    ).send({
      embeds: [
        new Discord.MessageEmbed()
          .setTitle('Admin Panel')
          .setURL(
            `${process.env.UI_URL}admin/${await mintCapabilityToken(
              msg.author.id,
              'admin'
            )}`
          ),
      ],
    });
    try {
      await msg.delete();
    } catch (e) {}
  },
};
const cmddump = {
  name: 'cmddump',
  syntax: 'cmddump <command: string>',
  explanation: "Wouldn't you like to know",
  version: 2,
  permissions: (msg: Discord.Message) => msg.author.id === '234020040830091265',
  responder: async (ctx: Types.Context, cmd: { command: string }) => {
    const commands = ctx.command_modules
      .flatMap((mod) =>
        mod.commands.map((c) => {
          return { module: mod, ...c };
        })
      )
      .filter((c) => c.name == cmd.command);
    if (commands.length == 0)
      throw new util_functions.BotError('user', 'Command not found');
    for (const command of commands) {
      await ctx.msg.dbReply({
        embeds: [
          new Discord.MessageEmbed()
            .setTitle(`Info for ${command.name}`)
            .setColor('#1dbb4f')
            .addField('Syntax', '`' + command.syntax + '`')
            .addField(
              'Parsed Grammar',
              `\`\`\`json\n${JSON.stringify(command.grammar, null, 2)}\`\`\``
            )
            .addField(
              'Help Syntax',
              '`' + generateCommandString(command.grammar) + '`'
            )
            .addField('Description', '*' + command.explanation + '*')
            .addField('Module', command.module.title),
        ],
      });
    }
  },
};
exports.commandModule = {
  title: 'Admin',
  description: 'Commands for bot admins',
  commands: [announce, admin, cmddump],
};
