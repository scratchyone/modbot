import { PrismaClient } from '@prisma/client';
import { Client, Message, TextChannel } from 'discord.js';
const prisma = new PrismaClient();
const util_functions = require('../util_functions');
import * as Types from '../types';
const alertchannel = {
  name: 'alertchannel',
  syntax: 'alertchannel <action: "enable" | "ignore" | "disable">',
  explanation: 'Configure the alert channel',
  permissions: (msg: Message) => msg.member?.permissions.has('MANAGE_CHANNELS'),
  responder: async (
    msg: Message,
    cmd: { action: 'enable' | 'ignore' | 'disable' },
    client: Client
  ) => {
    if (!msg.guild || !client.user) return;
    if (cmd.action === 'ignore') {
      await prisma.alert_channels_ignore.create({
        data: {
          server: msg.guild.id,
        },
      });
      msg.channel.send(
        'Disabled alert channel warning message. I strongly encourage you to setup an alert channel, it is very important'
      );
      await Types.LogChannel.tryToLog(
        msg,
        'Disabled alert channel warning message'
      );
    } else if (cmd.action === 'enable') {
      util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
      if (
        await prisma.alert_channels.findFirst({
          where: {
            server: msg.guild.id,
          },
        })
      ) {
        msg.channel.send(
          'An alert channel already exists! You can remove it with `m: alertchannel disable`'
        );
      } else {
        msg.channel.send('What should the channel be named?');
        const channel_name = await msg.channel.awaitMessages(
          (m) => m.author.id == msg.author.id,
          {
            max: 1,
            time: 20000,
          }
        );
        if (!channel_name.array().length) {
          await msg.channel.send(util_functions.desc_embed('Timed out'));
          return;
        }
        msg.channel.send(
          'What role should be allowed to view it? (Probably your moderator role)'
        );
        const role = await msg.channel.awaitMessages(
          (m) => m.author.id == msg.author.id,
          {
            max: 1,
            time: 10000,
          }
        );
        if (!role.array().length) {
          await msg.channel.send(util_functions.desc_embed('Timed out'));
          return;
        }
        const drole = msg.guild.roles.cache.get(
          role.array()[0].content.replace('<@&', '').replace('>', '')
        );
        if (!drole) {
          await msg.channel.send(
            util_functions.desc_embed("Role doesn't exist")
          );
          return;
        }
        const channel = await msg.guild.channels.create(
          channel_name.array()[0].content,
          {
            type: 'text',
            permissionOverwrites: [
              {
                id: msg.guild.id,
                deny: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
              },
              {
                id: client.user.id,
                allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
              },
              {
                id: drole.id,
                allow: ['VIEW_CHANNEL'],
              },
            ],
          }
        );
        await prisma.alert_channels.create({
          data: {
            channel: channel.id,
            server: msg.guild.id,
          },
        });
        await (client.channels.cache.get(
          (await prisma.alert_channels.findFirst({
            where: {
              server: msg.guild.id,
            },
          }))!.channel
        ) as TextChannel).send(
          util_functions.desc_embed('Alert channel enabled!')
        );
        await msg.channel.send(
          util_functions.desc_embed(`Created alert channel ${channel}`)
        );
        await Types.LogChannel.tryToLog(
          msg,
          `Created alert channel ${channel}`
        );
      }
    } else if (cmd.action === 'disable') {
      if (
        !(await prisma.alert_channels.findFirst({
          where: {
            server: msg.guild.id,
          },
        }))
      ) {
        msg.channel.send("An alert channel doesn't exist in this server!");
      } else {
        try {
          await (client.channels.cache.get(
            (await prisma.alert_channels.findFirst({
              where: {
                server: msg.guild.id,
              },
            }))!.channel
          )! as TextChannel).send(
            util_functions.desc_embed('Alert channel disabled!')
          );
        } catch (e) {}
        await prisma.alert_channels.deleteMany({
          where: {
            server: msg.guild.id,
          },
        });
        await msg.channel.send(util_functions.desc_embed('Disabled!'));
        await Types.LogChannel.tryToLog(msg, 'Disabled alert channel');
      }
    }
  },
};
exports.commandModule = {
  title: 'Alert Channel',
  description: 'Commands to configure your alert channel',
  commands: [alertchannel],
};
