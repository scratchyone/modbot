/* eslint-disable @typescript-eslint/no-var-requires */
import * as util_functions from '../util_functions';
import Discord from 'discord.js';
import { Command } from '../types';
import { mintCapabilityToken } from '../web';
import * as Types from '../types';

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
      const ralertchannel = client.channels.cache.get(alertchannel.channel);
      if (!ralertchannel || ralertchannel.type !== 'text') continue;
      await (ralertchannel as Discord.TextChannel).send(
        new Discord.MessageEmbed()
          .setTitle('Announcement')
          .setDescription(an_text)
      );
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
    await (await msg.author.createDM()).send(
      new Discord.MessageEmbed()
        .setTitle('Admin Panel')
        .setURL(
          `${process.env.UI_URL}admin/${await mintCapabilityToken(
            msg.author.id,
            'admin'
          )}`
        )
    );
    try {
      await msg.delete();
    } catch (e) {}
  },
};
exports.commandModule = {
  title: 'Admin',
  description: 'Commands for bot admins',
  commands: [announce, admin],
};
