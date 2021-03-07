import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
let util_functions = require('../util_functions');
const Discord = require('discord.js');
const onStarReactRemove = async (reaction, client) => {
  if (
    (await prisma.starboard_messages.findFirst({
      where: {
        message: reaction.message.id,
      },
    })) &&
    !prisma.starboards.findFirst({
      where: {
        channel: reaction.message.channel.id,
      },
    })
  ) {
    let sb = await prisma.starboards.findFirst({
      where: {
        server: reaction.message.guild.id,
      },
    });
    if (sb && sb.stars > reaction.count) {
      let sb_msg_db = await prisma.starboard_messages.findFirst({
        where: {
          message: reaction.message.id,
        },
      });
      try {
        await (
          await client.channels.cache
            .get(sb.channel)
            .messages.fetch(sb_msg_db.starboard_message)
        ).delete();
      } catch (e) {
        console.log(e);
      }
      await prisma.starboard_messages.deleteMany({
        where: {
          message: reaction.message.id,
        },
      });
    } else {
      console.log('no sb');
    }
  }
  if (
    (await prisma.starboard_messages.findFirst({
      where: {
        message: reaction.message.id,
      },
    })) &&
    !prisma.starboards.findFirst({
      where: {
        channel: reaction.message.channel.id,
      },
    })
  ) {
    let sb_msg = await prisma.starboard_messages.findFirst({
      where: {
        message: reaction.message.id,
      },
    });
    let sb_chan = client.channels.cache.get(sb_msg.starboard_message_channel);
    let sb_disc_msg = await sb_chan.messages.fetch(sb_msg.starboard_message);
    await sb_disc_msg.edit(await genSBMessage(reaction.message));
  }
};
async function genSBMessage(message) {
  let msg_username = message.author.username;
  try {
    msg_username = (await message.guild.member(message.author)).displayName;
  } catch (e) {
    //
  }
  let desc = message.content;
  if (message.embeds.length) {
    if (desc) {
      desc += '\n\n';
    }
    if (message.embeds[0].author)
      desc += '> **' + message.embeds[0].author.name + '**\n';
    if (message.embeds[0].title)
      desc += '> **' + message.embeds[0].title + '**\n';
    desc += '> ' + (message.embeds[0].description || '');
  }
  let image;
  let spoiler = false;
  if (message.attachments.array().length) {
    image = message.attachments.array().map((n) => n.url)[0];
    if (message.attachments.array()[0].name.startsWith('SPOILER_'))
      spoiler = true;
  } else if (message.embeds.length > 0 && message.embeds[0].type === 'image') {
    image = message.embeds[0].url;
    if (message.content.includes('||')) spoiler = true;
  }
  let isImage =
    image &&
    ['png', 'jpeg', 'gif', 'jpg', 'tiff'].includes(
      image.split('.')[image.split('.').length - 1]
    );
  if (spoiler)
    return {
      content: `${message.reactions.cache.get('⭐').count} ⭐\n${
        message.channel
      }`,
      files: [
        new Discord.MessageAttachment(
          image,
          'SPOILER_image.' + image.split('.')[image.split('.').length - 1]
        ),
      ],
      embed: new Discord.MessageEmbed()
        .setAuthor(msg_username, await message.author.displayAvatarURL())
        .setDescription(desc + '\n\n**[Source](' + message.url + ')**'),
    };
  else if (!isImage && image)
    return {
      content: `${message.reactions.cache.get('⭐').count} ⭐\n${
        message.channel
      }`,
      files: [
        new Discord.MessageAttachment(
          image,
          'vid.' + image.split('.')[image.split('.').length - 1]
        ),
      ],
      embed: new Discord.MessageEmbed()
        .setAuthor(msg_username, await message.author.displayAvatarURL())
        .setDescription(desc + '\n\n**[Source](' + message.url + ')**'),
    };
  else
    return {
      content: `${message.reactions.cache.get('⭐').count} ⭐\n${
        message.channel
      }`,
      embed: new Discord.MessageEmbed()
        .setAuthor(msg_username, await message.author.displayAvatarURL())
        .setDescription(desc + '\n\n**[Source](' + message.url + ')**')
        .setImage(image),
    };
}
const onStarReactAdd = async (reaction, client) => {
  if (
    !(await prisma.starboard_messages.findFirst({
      where: {
        message: reaction.message.id,
      },
    })) &&
    !(await prisma.starboards.findFirst({
      where: {
        channel: reaction.message.channel.id,
      },
    }))
  ) {
    try {
      let sb = await prisma.starboards.findFirst({
        where: {
          server: reaction.message.guild.id,
          stars: {
            lte: reaction.count,
          },
        },
      });
      if (sb) {
        let sb_chan = client.channels.cache.get(sb.channel);
        let sb_msg = await sb_chan.send(await genSBMessage(reaction.message));
        await prisma.starboard_messages.create({
          data: {
            message: reaction.message.id,
            starboard_message: sb_msg.id,
            message_channel: reaction.message.channel.id,
            server: reaction.message.guild.id,
            starboard_message_channel: sb_msg.channel.id,
          },
        });
      }
    } catch (e) {
      console.log(e);
    }
  } else if (
    (await prisma.starboard_messages.findFirst({
      where: {
        message: reaction.message.id,
      },
    })) &&
    !(await prisma.starboards.findFirst({
      where: {
        channel: reaction.message.channel.id,
      },
    }))
  ) {
    let sb_msg = await prisma.starboard_messages.findFirst({
      where: {
        message: reaction.message.id,
      },
    });
    let sb_chan = client.channels.cache.get(sb_msg.starboard_message_channel);
    let sb_disc_msg = await sb_chan.messages.fetch(sb_msg.starboard_message);
    await sb_disc_msg.edit(
      sb_disc_msg.edit(await genSBMessage(reaction.message))
    );
  }
};
async function starboardMessageToRealSBMsg(s, client) {
  let sb_chan = client.channels.cache.get(s.starboard_message_channel);
  let sb_disc_msg = await sb_chan.messages.fetch(s.starboard_message);
  return sb_disc_msg;
}
const onMessageEdit = async (old, newm, client) => {
  if (
    await prisma.starboard_messages.findFirst({
      where: {
        message: newm.id,
      },
    })
  ) {
    let sb_msg = await prisma.starboard_messages.findFirst({
      where: {
        message: newm.id,
      },
    });
    let real_msg = await starboardMessageToRealSBMsg(sb_msg, client);
    await real_msg.edit(await genSBMessage(newm));
  }
};
const onMessageDelete = async (msg, client) => {
  if (
    await prisma.starboard_messages.findFirst({
      where: {
        message: msg.id,
      },
    })
  ) {
    let sb_msg = await prisma.starboard_messages.findFirst({
      where: {
        message: msg.id,
      },
    });
    let real_msg = await starboardMessageToRealSBMsg(sb_msg, client);
    await real_msg.delete();
    await prisma.starboard_messages.deleteMany({
      where: {
        message: msg.id,
      },
    });
  }
};
import * as Types from '../types';
let starboardCommand = {
  name: 'starboard',
  syntax: 'm: starboard <enable/disable/configure/fixperms>',
  explanation: 'Configure the starboard',
  long_explanation:
    'Create/Delete the starboard with `enable`/`disable`. Change starboard settings with `configure`. Fix the channel permissions for the starboard channel with `fixperms`',
  matcher: (cmd) => cmd.command == 'starboard',
  simplematcher: (cmd) => cmd[0] === 'starboard',
  permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
  responder: async (msg, cmd, client) => {
    if (cmd.action === 'enable') {
      util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
      if (
        await prisma.starboards.findFirst({
          where: {
            server: msg.guild.id,
          },
        })
      ) {
        await msg.channel.send(
          util_functions.desc_embed('Starboard already exists')
        );
      } else {
        await msg.channel.send('What should I name the channel?');
        let sb_name = await msg.channel.awaitMessages(
          (m) => m.author.id == msg.author.id,
          {
            max: 1,
            time: 10000,
          }
        );
        if (!sb_name.array().length) {
          await msg.channel.send(util_functions.desc_embed('Timed out'));
          return;
        }
        let channel = await msg.guild.channels.create(
          sb_name.array()[0].content,
          {
            type: 'text',
            permissionOverwrites: [
              {
                id: msg.guild.id,
                deny: ['SEND_MESSAGES'],
              },
              {
                id: client.user.id,
                allow: ['SEND_MESSAGES'],
              },
            ],
          }
        );
        await prisma.starboards.create({
          data: {
            channel: channel.id,
            server: msg.guild.id,
            stars: 3,
          },
        });
        await msg.channel.send(
          util_functions.desc_embed(
            `Created ${channel}. Default stars required are 3. You can change this with \`m: starboard configure\``
          )
        );
        await Types.LogChannel.tryToLog(msg, `Created starboard ${channel}`);
      }
    } else if (cmd.action === 'fixperms') {
      let sb = await prisma.starboards.findFirst({
        where: {
          server: msg.guild.id,
        },
      });
      if (sb) {
        await (
          await client.channels.cache.get(sb.channel)
        ).overwritePermissions([
          {
            id: msg.guild.id,
            deny: ['SEND_MESSAGES'],
          },
          {
            id: client.user.id,
            allow: ['SEND_MESSAGES'],
          },
        ]);
        await msg.channel.send(util_functions.desc_embed('Fixed permissions'));
        await Types.LogChannel.tryToLog(
          msg,
          `Fixed permissions for starboard channel <#${sb.channel}>`
        );
      } else {
        await msg.channel.send(util_functions.desc_embed('No starboard found'));
      }
    } else if (cmd.action === 'disable') {
      let sb = await prisma.starboards.findFirst({
        where: {
          server: msg.guild.id,
        },
      });
      if (sb) {
        let choice = await util_functions.embed_options(
          'Would you like to delete the old channel?',
          ['Yes', 'No'],
          ['✅', '❌'],
          msg
        );
        if (choice !== null) {
          let conf = await util_functions.confirm(msg);
          if (conf) {
            if (choice === 0) {
              try {
                await (await client.channels.cache.get(sb.channel)).delete();
              } catch (e) {
                //
              }
            }
            await prisma.starboards.deleteMany({
              where: {
                server: msg.guild.id,
              },
            });
            await prisma.starboard_messages.deleteMany({
              where: {
                server: msg.guild.id,
              },
            });
            await msg.channel.send(
              util_functions.desc_embed('Deleted starboard')
            );
          }
        }
        await Types.LogChannel.tryToLog(msg, 'Deleted starboard');
      } else {
        await msg.channel.send(util_functions.desc_embed('No starboard found'));
      }
    } else if (cmd.action === 'configure') {
      let sb = await prisma.starboards.findFirst({
        where: {
          server: msg.guild.id,
        },
      });
      if (sb) {
        let choice = await util_functions.embed_options(
          'What do you want to configure?',
          ['Stars Required'],
          ['🌟'],
          msg
        );
        if (choice === 0) {
          await msg.channel.send('How many stars should be required?');
          let stars_req = await msg.channel.awaitMessages(
            (m) => m.author.id == msg.author.id,
            {
              max: 1,
              time: 10000,
            }
          );
          if (!stars_req.array().length) {
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          if (parseInt(stars_req.array()[0].content) < 1) {
            await msg.channel.send(
              util_functions.desc_embed("Can't be less than one star")
            );
            return;
          } else {
            await prisma.starboards.update({
              data: {
                stars: parseInt(stars_req.array()[0].content),
              },
              where: {
                server: msg.guild.id,
              },
            });
            await msg.channel.send(util_functions.desc_embed('Updated!'));
            await Types.LogChannel.tryToLog(
              msg,
              `Changed required stars for starboard to ${
                stars_req.array()[0].content
              }`
            );
          }
        }
      } else {
        await msg.channel.send(util_functions.desc_embed('No starboard found'));
      }
    }
  },
};
let starGetCommand = {
  name: 'star',
  syntax: 'm: star <random>',
  explanation: 'Get a star',
  long_explanation: 'Get a message from the starboard',
  matcher: (cmd) => cmd.command == 'star',
  simplematcher: (cmd) => cmd[0] === 'star',
  permissions: () => true,
  responder: async (msg, cmd, client) => {
    let sb = await prisma.starboards.findFirst({
      where: {
        server: msg.guild.id,
      },
    });
    if (sb) {
      if (cmd.action === 'random') {
        let star = util_functions.randArrayItem(
          await prisma.starboard_messages.findFirst({
            where: {
              server: msg.guild.id,
            },
          })
        );
        if (!star) {
          msg.channel.send('No Stars!');
          return;
        }
        let sb_msg;
        try {
          sb_msg = await client.channels.cache
            .get(sb.channel)
            .messages.fetch(star.starboard_message);
        } catch (e) {
          console.log(e);
          await prisma.starboard_messages.deleteMany({
            where: {
              message: star.message,
            },
          });
          await msg.channel.send(
            util_functions.desc_embed(
              "Message doesn't exist, it may have been removed from the starboard"
            )
          );
          return;
        }
        await msg.channel.send({ embed: sb_msg.embeds[0] });
      }
    } else {
      msg.channel.send(util_functions.desc_embed('No starboard found'));
    }
  },
};
exports.commandModule = {
  title: 'Starboard',
  description:
    'Commands related to creating, deleting, and configuring the starboard',
  commands: [starboardCommand, starGetCommand],
  cog: async (client) => {
    client.on('messageReactionAdd', async (reaction, user) => {
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
        if (reaction.emoji.name == '⭐') {
          await onStarReactAdd(reaction, client);
        }
      } catch (e) {}
    });
    client.on('messageReactionRemove', async (reaction, user) => {
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
        if (reaction.emoji.name == '⭐') {
          await onStarReactRemove(reaction, client);
        }
      } catch (e) {}
    });
    client.on('messageUpdate', async (omsg, nmsg) => {
      if (nmsg.partial) {
        // If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
        try {
          await nmsg.fetch();
        } catch (error) {
          console.log(
            'Something went wrong when fetching the message: ',
            error
          );
          // Return as `reaction.message.author` may be undefined/null
          return;
        }
      }
      await onMessageEdit(omsg, nmsg, client);
    });
    client.on('messageDelete', async (msg) => {
      await onMessageDelete(msg, client);
    });
    client.on('messageDeleteBulk', async (msgs) => {
      for (const msg of msgs.array()) {
        await onMessageDelete(msg, client);
      }
    });
  },
};
