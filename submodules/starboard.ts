import { PrismaClient, starboard_messages } from '@prisma/client';
const prisma = new PrismaClient();
import * as util_functions from '../util_functions';
import Discord, { MessageReaction, Snowflake } from 'discord.js';
import LogBit from 'logbit';
const log = new LogBit('Starboard');
async function genSBMessage(message: Discord.Message, count: number) {
  let msg_username = message.author.username;
  try {
    const m = await message.channel.messages.fetch(message.id, {
      force: true,
      cache: false,
    });
    msg_username = m.author.username;
    log.info(
      `Found message ${message.id} in channel ${message.channel.id} with username ${m.author.username}`
    );
  } catch (e) {
    log.error(e);
  }
  try {
    if (!message.webhookId) {
      msg_username = (await message.guild!.members.cache.get(
        message.author.id
      ))!.displayName;
    }
  } catch (e) {
    log.warn('Failed to fetch starboard message author');
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
    if (message.embeds[0].description)
      desc += '> ' + message.embeds[0].description.split('\n').join('\n> ');
  }
  let image;
  let spoiler = false;
  if ([...message.attachments.values()].length) {
    image = [...message.attachments.values()].map((n) => n.url)[0];
    if ([...message.attachments.values()][0].name!.startsWith('SPOILER_'))
      spoiler = true;
  } else if (message.embeds.length > 0 && message.embeds[0].type === 'image') {
    image = message.embeds[0].url;
    if (message.content.includes('||')) spoiler = true;
  }
  const isImage =
    image &&
    ['png', 'jpeg', 'gif', 'jpg', 'tiff'].includes(
      image.split('.')[image.split('.').length - 1]
    );
  if (spoiler)
    return {
      content: `${count} ⭐\n${message.channel}`,
      files: [
        new Discord.MessageAttachment(
          image as string,
          'SPOILER_image.' +
            (image as string).split('.')[
              (image as string).split('.').length - 1
            ]
        ),
      ],
      embeds: [
        new Discord.MessageEmbed()
          .setAuthor(msg_username, await message.author.displayAvatarURL())
          .setDescription(desc + '\n\n**[Source](' + message.url + ')**'),
      ],
    };
  else if (!isImage && image)
    return {
      content: `${count} ⭐\n${message.channel}`,
      files: [
        new Discord.MessageAttachment(
          image,
          'vid.' + image.split('.')[image.split('.').length - 1]
        ),
      ],
      embeds: [
        new Discord.MessageEmbed()
          .setAuthor(msg_username, await message.author.displayAvatarURL())
          .setDescription(desc + '\n\n**[Source](' + message.url + ')**'),
      ],
    };
  else
    return {
      content: `${count} ⭐\n${message.channel}`,
      embeds: [
        new Discord.MessageEmbed()
          .setAuthor(msg_username, await message.author.displayAvatarURL())
          .setDescription(desc + '\n\n**[Source](' + message.url + ')**')
          .setImage(image as string),
      ],
    };
}
async function handleReactionCountChange(
  reaction: Discord.MessageReaction,
  client: Discord.Client
) {
  if (reaction.emoji.name === '⭐') {
    log.trace('Handling star reaction count change');
    const { existingStarboardMessage, count, rootMessage } =
      await getStarboardMessageData(
        reaction.message as Discord.Message,
        client
      );
    const starboard = await prisma.starboards.findFirst({
      where: {
        server: reaction.message.guild?.id,
      },
    });
    if (!starboard) {
      log.error('No starboard found for server');
      return;
    }
    if (!existingStarboardMessage)
      log.trace('Message is not already on starboard');
    if (existingStarboardMessage && count < starboard.stars) {
      log.debug('Removing starboard message');
      // Message (probably) exists on starboard but shouldn't
      // Get the actual discord message that is tied to the database entry
      const discordMessageInStarboardChannel =
        await starboardMessageToRealSBMsg(existingStarboardMessage, client);
      try {
        // Delete the message from the starboard
        await discordMessageInStarboardChannel.delete();
      } catch (e) {}
      // Delete the database entry too
      await prisma.starboard_messages.delete({
        where: {
          message: rootMessage.id,
        },
      });
    } else if (!existingStarboardMessage && count >= starboard.stars) {
      log.debug('Creating new starboard message');
      // There is no message on the starboard, but there should be
      // Generate a post a starboard embed to the starboard channel
      const starboardChannel = client.channels.cache.get(
        starboard.channel as `${bigint}`
      ) as Discord.TextChannel;
      const starboardMessage = await starboardChannel.send(
        await genSBMessage(rootMessage, count)
      );
      if (!reaction.message.guild) return;
      // Add the starboard message to the database
      await prisma.starboard_messages.create({
        data: {
          message: rootMessage.id,
          message_channel: rootMessage.channel.id,
          server: reaction.message.guild.id,
          starboard_message: starboardMessage.id,
          starboard_message_channel: starboardChannel.id,
        },
      });
    } else if (existingStarboardMessage) {
      log.debug('Updating existing starboard message');
      // Message exists on starboard, but should be updated with new information
      // Get the actual discord message that is tied to the database entry
      const discordMessageInStarboardChannel =
        await starboardMessageToRealSBMsg(existingStarboardMessage, client);
      // Update the starboard message
      await discordMessageInStarboardChannel.edit(
        await genSBMessage(rootMessage as Discord.Message, count)
      );
    }
  }
}
const onStarReactRemove = async (
  reaction: Discord.MessageReaction,
  client: Discord.Client
) => {
  await handleReactionCountChange(reaction, client);
};
const onStarReactAdd = async (
  reaction: Discord.MessageReaction,
  client: Discord.Client
) => {
  await handleReactionCountChange(reaction, client);
};
async function getStarboardMessageData(
  message: Discord.Message,
  client: Discord.Client<boolean>
) {
  let existingStarboardMessage = await prisma.starboard_messages.findFirst({
    where: {
      message: message.id,
    },
  });

  // If you're starring a message that itself is on the starboard, treat it like you're starring the source message
  const messageOnStarboard = await prisma.starboard_messages.findFirst({
    where: {
      starboard_message: message.id,
    },
  });
  let count = message.reactions.cache.get('⭐')?.count || 0;
  if (messageOnStarboard) {
    existingStarboardMessage = messageOnStarboard;
  }
  if (existingStarboardMessage) {
    count = await countStarsOnMessage(existingStarboardMessage, client, count);
  }
  let rootMessage = message;
  if (messageOnStarboard) {
    rootMessage = await starboardMessageToRealSourceMsg(
      messageOnStarboard,
      client
    );
  }
  return { existingStarboardMessage, count, rootMessage };
}

async function countStarsOnMessage(
  existingStarboardMessage: starboard_messages,
  client: Discord.Client<boolean>,
  count: number
) {
  const sourceMessage = await starboardMessageToRealSourceMsg(
    existingStarboardMessage,
    client
  );
  const sbMessage = await starboardMessageToRealSBMsg(
    existingStarboardMessage,
    client
  );
  const origUsers = [
    ...((
      await sourceMessage.reactions.cache.get('⭐')?.users.fetch()
    )?.values() || []),
  ];
  const sbUsers = [
    ...((await sbMessage.reactions.cache.get('⭐')?.users.fetch())?.values() ||
      []),
  ];
  const deDuped = [
    ...new Set([...origUsers.map((n) => n.id), ...sbUsers.map((n) => n.id)]),
  ];
  log.debug(deDuped);
  count = deDuped.length;
  return count;
}

async function starboardMessageToRealSBMsg(s: any, client: Discord.Client) {
  const sb_chan = client.channels.cache.get(s.starboard_message_channel) as
    | Discord.TextChannel
    | undefined;
  const sb_disc_msg = await sb_chan!.messages.fetch(s.starboard_message);
  return sb_disc_msg;
}
async function starboardMessageToRealSourceMsg(s: any, client: Discord.Client) {
  const sb_chan = client.channels.cache.get(s.message_channel) as
    | Discord.TextChannel
    | undefined;
  const sb_disc_msg = await sb_chan!.messages.fetch(s.message);
  return sb_disc_msg;
}
const onMessageEdit = async (
  old: util_functions.EMessage,
  newm: util_functions.EMessage,
  client: Discord.Client
) => {
  if (
    await prisma.starboard_messages.findFirst({
      where: {
        message: newm.id,
      },
    })
  ) {
    const sb_msg = await prisma.starboard_messages.findFirst({
      where: {
        message: newm.id,
      },
    });
    const { count, existingStarboardMessage } = await getStarboardMessageData(
      newm,
      client
    );
    const real_msg = await starboardMessageToRealSBMsg(
      existingStarboardMessage,
      client
    );
    await real_msg.edit(await genSBMessage(newm, count));
  }
};
const onMessageDelete = async (
  msg: util_functions.EMessage,
  client: Discord.Client
) => {
  if (
    await prisma.starboard_messages.findFirst({
      where: {
        message: msg.id,
      },
    })
  ) {
    const sb_msg = await prisma.starboard_messages.findFirst({
      where: {
        message: msg.id,
      },
    });
    const real_msg = await starboardMessageToRealSBMsg(sb_msg, client);
    await real_msg.delete();
    await prisma.starboard_messages.deleteMany({
      where: {
        message: msg.id,
      },
    });
  }
};
import * as Types from '../types';
const starboardCommand = {
  name: 'starboard',
  syntax: 'starboard <action: "enable" | "disable" | "configure" | "fixperms">',
  explanation: 'Configure the starboard',
  long_explanation:
    'Create/Delete the starboard with `enable`/`disable`. Change starboard settings with `configure`. Fix the channel permissions for the starboard channel with `fixperms`',
  permissions: (msg: Discord.Message) =>
    msg.member?.permissions.has('MANAGE_CHANNELS'),
  responder: async (
    msg: util_functions.EMessage,
    cmd: { action: 'enable' | 'disable' | 'configure' | 'fixperms' },
    client: Discord.Client
  ) => {
    if (!msg.guild || !client.user) return;
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
        const sb_name = await msg.channel.awaitMessages({
          max: 1,
          time: 10000,
          filter: (m) => m.author.id == msg.author.id,
        });
        if (![...sb_name.values()].length) {
          await msg.channel.send(util_functions.desc_embed('Timed out'));
          return;
        }
        const channel = await msg.guild.channels.create(
          [...sb_name.values()][0].content,
          {
            type: 'GUILD_TEXT',
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
      const sb = await prisma.starboards.findFirst({
        where: {
          server: msg.guild.id,
        },
      });
      if (sb) {
        await (
          (await client.channels.cache.get(
            sb.channel as Snowflake
          )!) as Discord.TextChannel
        ).permissionOverwrites.set([
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
      const sb = await prisma.starboards.findFirst({
        where: {
          server: msg.guild.id,
        },
      });
      if (sb) {
        const choice = await util_functions.embed_options(
          'Would you like to delete the old channel?',
          ['Yes', 'No'],
          ['✅', '❌'],
          msg
        );
        if (choice !== null) {
          const conf = await util_functions.confirm(msg);
          if (conf) {
            if (choice === 0) {
              try {
                await (
                  await client.channels.cache.get(sb.channel as Snowflake)!
                ).delete();
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
      const sb = await prisma.starboards.findFirst({
        where: {
          server: msg.guild.id,
        },
      });
      if (sb) {
        const choice = await util_functions.embed_options(
          'What do you want to configure?',
          ['Stars Required'],
          ['🌟'],
          msg
        );
        if (choice === 0) {
          await msg.channel.send('How many stars should be required?');
          const stars_req = await msg.channel.awaitMessages({
            max: 1,
            time: 10000,
            filter: (m) => m.author.id == msg.author.id,
          });
          if (![...stars_req.values()].length) {
            await msg.channel.send(util_functions.desc_embed('Timed out'));
            return;
          }
          if (parseInt([...stars_req.values()][0].content) < 1) {
            await msg.channel.send(
              util_functions.desc_embed("Can't be less than one star")
            );
            return;
          } else {
            await prisma.starboards.update({
              data: {
                stars: parseInt([...stars_req.values()][0].content),
              },
              where: {
                server: msg.guild.id,
              },
            });
            await msg.channel.send(util_functions.desc_embed('Updated!'));
            await Types.LogChannel.tryToLog(
              msg,
              `Changed required stars for starboard to ${
                [...stars_req.values()][0].content
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
const starGetCommand = {
  name: 'star',
  syntax: 'star <action: "random">',
  explanation: 'Get a star',
  long_explanation: 'Get a message from the starboard',
  permissions: () => true,
  responder: async (
    msg: util_functions.EMessage,
    cmd: { action: 'random' },
    client: Discord.Client
  ) => {
    if (!msg.guild) return;
    const sb = await prisma.starboards.findFirst({
      where: {
        server: msg.guild.id,
      },
    });
    if (sb) {
      if (cmd.action === 'random') {
        const star = util_functions.randArrayItem(
          await prisma.starboard_messages.findMany({
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
          sb_msg = await (
            client.channels!.cache!.get(
              sb.channel as Snowflake
            )! as Discord.TextChannel
          ).messages.fetch(star.starboard_message as Snowflake);
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
        await msg.channel.send({ embeds: [sb_msg.embeds[0]] });
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
  cog: async (client: Discord.Client) => {
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
          await onStarReactAdd(reaction as MessageReaction, client);
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
          await onStarReactRemove(reaction as MessageReaction, client);
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
      await onMessageEdit(
        omsg as util_functions.EMessage,
        nmsg as util_functions.EMessage,
        client
      );
    });
    client.on('messageDelete', async (msg) => {
      await onMessageDelete(msg as util_functions.EMessage, client);
    });
    client.on('messageDeleteBulk', async (msgs) => {
      for (const msg of [...msgs.values()]) {
        await onMessageDelete(msg as util_functions.EMessage, client);
      }
    });
  },
};
