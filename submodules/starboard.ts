import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import * as util_functions from '../util_functions';
import Discord, { MessageReaction, Snowflake } from 'discord.js';
const onStarReactRemove = async (
  reaction: Discord.MessageReaction,
  client: Discord.Client
) => {
  if (!reaction.message.guild || !reaction.count) return;
  if (
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
    const sb = await prisma.starboards.findFirst({
      where: {
        server: reaction.message.guild.id,
      },
    });
    if (sb && sb.stars > reaction.count) {
      const sb_msg_db = await prisma.starboard_messages.findFirst({
        where: {
          message: reaction.message.id,
        },
      });
      try {
        await (
          await (
            client.channels.cache!.get(
              sb.channel as Snowflake
            )! as Discord.TextChannel
          ).messages!.fetch(sb_msg_db!.starboard_message as Snowflake)
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
    }
  }
  if (
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
    const sb_msg = await prisma.starboard_messages.findFirst({
      where: {
        message: reaction.message.id,
      },
    });
    const sb_chan = client.channels.cache.get(
      sb_msg!.starboard_message_channel as Snowflake
    ) as Discord.TextChannel | undefined;
    const sb_disc_msg = await sb_chan!.messages!.fetch(
      sb_msg!.starboard_message as Snowflake
    );
    await sb_disc_msg.edit(
      await genSBMessage(reaction.message as Discord.Message)
    );
  }
};
async function genSBMessage(message: Discord.Message) {
  let msg_username = message.author.username;
  try {
    msg_username = (await message.guild!.members.cache.get(message.author.id))!
      .displayName;
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
    if (message.embeds[0].description)
      desc += '> ' + message.embeds[0].description.split('\n').join('\n> ');
  }
  let image;
  let spoiler = false;
  if (message.attachments.array().length) {
    image = message.attachments.array().map((n) => n.url)[0];
    if (message.attachments.array()[0].name!.startsWith('SPOILER_'))
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
      content: `${message.reactions.cache.get('⭐')!.count} ⭐\n${
        message.channel
      }`,
      files: [
        new Discord.MessageAttachment(
          image as string,
          'SPOILER_image.' +
            (image as string).split('.')[
              (image as string).split('.').length - 1
            ]
        ),
      ],
      embed: new Discord.MessageEmbed()
        .setAuthor(msg_username, await message.author.displayAvatarURL())
        .setDescription(desc + '\n\n**[Source](' + message.url + ')**'),
    };
  else if (!isImage && image)
    return {
      content: `${message.reactions.cache.get('⭐')!.count} ⭐\n${
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
      content: `${message.reactions.cache.get('⭐')!.count} ⭐\n${
        message.channel
      }`,
      embed: new Discord.MessageEmbed()
        .setAuthor(msg_username, await message.author.displayAvatarURL())
        .setDescription(desc + '\n\n**[Source](' + message.url + ')**')
        .setImage(image as string),
    };
}
const onStarReactAdd = async (
  reaction: Discord.MessageReaction,
  client: Discord.Client
) => {
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
      const sb = await prisma.starboards.findFirst({
        where: {
          server: reaction.message.guild!.id,
          stars: {
            lte: reaction.count || undefined,
          },
        },
      });
      if (sb) {
        const sb_chan = client.channels.cache.get(sb.channel as Snowflake) as
          | Discord.TextChannel
          | undefined;
        const sb_msg = await sb_chan!.send(
          await genSBMessage(reaction.message as Discord.Message)
        );
        await prisma.starboard_messages.create({
          data: {
            message: reaction.message.id,
            starboard_message: sb_msg.id,
            message_channel: reaction.message.channel.id,
            server: reaction.message.guild!.id,
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
    const sb_msg = await prisma.starboard_messages.findFirst({
      where: {
        message: reaction.message.id,
      },
    });
    const sb_chan = client.channels.cache.get(
      sb_msg!.starboard_message_channel as Snowflake
    ) as Discord.TextChannel | undefined;
    const sb_disc_msg = await sb_chan!.messages.fetch(
      sb_msg!.starboard_message as Snowflake
    );
    await sb_disc_msg.edit(
      await genSBMessage(reaction.message as Discord.Message)
    );
  }
};
async function starboardMessageToRealSBMsg(s: any, client: Discord.Client) {
  const sb_chan = client.channels.cache.get(s.starboard_message_channel) as
    | Discord.TextChannel
    | undefined;
  const sb_disc_msg = await sb_chan!.messages.fetch(s.starboard_message);
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
    const real_msg = await starboardMessageToRealSBMsg(sb_msg, client);
    await real_msg.edit(await genSBMessage(newm));
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
        if (!sb_name.array().length) {
          await msg.channel.send(util_functions.desc_embed('Timed out'));
          return;
        }
        const channel = await msg.guild.channels.create(
          sb_name.array()[0].content,
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
      for (const msg of msgs.array()) {
        await onMessageDelete(msg as util_functions.EMessage, client);
      }
    });
  },
};
