const db = require('better-sqlite3')('perms.db3', {});
let util_functions = require('../util_functions.js');
const Discord = require('discord.js');
exports.onStarReactRemove = async (reaction, client) => {
  if (
    db
      .prepare('SELECT * FROM starboard_messages WHERE message=?')
      .get(reaction.message.id) &&
    !db
      .prepare('SELECT * FROM starboards WHERE channel=?')
      .get(reaction.message.channel.id)
  ) {
    let sb = db
      .prepare('SELECT * FROM starboards WHERE server=?')
      .get(reaction.message.guild.id);
    if (sb && sb.stars > reaction.count) {
      let sb_msg_db = db
        .prepare('SELECT * FROM starboard_messages WHERE message=?')
        .get(reaction.message.id);
      try {
        await (
          await client.channels.cache
            .get(sb.channel)
            .messages.fetch(sb_msg_db.starboard_message)
        ).delete();
      } catch (e) {
        console.log(e);
      }
      db.prepare('DELETE FROM starboard_messages WHERE message=?').run(
        reaction.message.id
      );
    } else {
      console.log('no sb');
    }
  }
};
exports.onStarReactAdd = async (reaction, client) => {
  if (
    !db
      .prepare('SELECT * FROM starboard_messages WHERE message=?')
      .get(reaction.message.id) &&
    !db
      .prepare('SELECT * FROM starboards WHERE channel=?')
      .get(reaction.message.channel.id)
  ) {
    try {
      let sb = db
        .prepare('SELECT * FROM starboards WHERE server=? AND stars<=?')
        .get(reaction.message.guild.id, reaction.count);
      if (sb) {
        let sb_chan = client.channels.cache.get(sb.channel);
        let msg_username = reaction.message.author.username;
        try {
          msg_username = (
            await reaction.message.guild.member(reaction.message.author)
          ).nickname;
          if (!msg_username) {
            msg_username = reaction.message.author.username;
          }
        } catch (e) {
          //
        }
        let desc = reaction.message.content;
        if (reaction.message.embeds.length) {
          if (desc) {
            desc += '\n';
          }
          if (reaction.message.embeds[0].title)
            desc += '**' + reaction.message.embeds[0].title + '**\n';
          desc += reaction.message.embeds[0].description || '';
        }
        let sb_msg = await sb_chan.send(
          new Discord.MessageEmbed()
            .setAuthor(
              msg_username,
              await reaction.message.author.displayAvatarURL()
            )
            .setDescription(
              desc + '\n\n**[Source](' + reaction.message.url + ')**'
            )
            .setImage(
              reaction.message.attachments.array()
                ? reaction.message.attachments.array().map((n) => n.url)[0]
                : null
            )
        );

        //files: reaction.message.attachments.array().map((n) => n.url),
        //});
        db.prepare('INSERT INTO starboard_messages VALUES (?, ?, ?)').run(
          reaction.message.id,
          sb_msg.id,
          reaction.message.guild.id
        );
      }
    } catch (e) {
      console.log(e);
    }
  }
};

let starboardCommand = {
  name: 'starboard',
  syntax: 'm: starboard <enable/disable/configure/fixperms>',
  explanation: 'Configure the starboard',
  long_explanation:
    'Create/Delete the starboard with `enable`/`disable`. Change starboard settings with `configure`. Fix the channel permissions for the starboard channel with `fixperms`',
  matcher: (cmd) => cmd.command == 'starboard',
  permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
  responder: async (msg, cmd, client) => {
    if (cmd.action === 'enable') {
      if (
        db.prepare('SELECT * FROM starboards WHERE server=?').get(msg.guild.id)
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
        db.prepare('INSERT INTO starboards VALUES (?, ?, ?)').run(
          channel.id,
          msg.guild.id,
          3
        );
        await msg.channel.send(
          util_functions.desc_embed(
            `Created ${channel}. Default stars required are 3. You can change this with \`m: starboard configure\``
          )
        );
      }
    } else if (cmd.action === 'fixperms') {
      let sb = db
        .prepare('SELECT * FROM starboards WHERE server=?')
        .get(msg.guild.id);
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
        await msg.channel.send(util_functions.desc_embed(`Fixed permissions`));
      } else {
        await msg.channel.send(util_functions.desc_embed(`No starboard found`));
      }
    } else if (cmd.action === 'disable') {
      let sb = db
        .prepare('SELECT * FROM starboards WHERE server=?')
        .get(msg.guild.id);
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
            db.prepare('DELETE FROM starboards WHERE server=?').run(
              msg.guild.id
            );
            db.prepare('DELETE FROM starboard_messages WHERE server=?').run(
              msg.guild.id
            );
            await msg.channel.send(
              util_functions.desc_embed(`Deleted starboard`)
            );
          }
        }
      } else {
        await msg.channel.send(util_functions.desc_embed(`No starboard found`));
      }
    } else if (cmd.action === 'configure') {
      let sb = db
        .prepare('SELECT * FROM starboards WHERE server=?')
        .get(msg.guild.id);
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
            db.prepare('UPDATE starboards SET stars=? WHERE server=?').run(
              parseInt(stars_req.array()[0].content),
              msg.guild.id
            );
            await msg.channel.send(util_functions.desc_embed('Updated!'));
          }
        }
      } else {
        await msg.channel.send(util_functions.desc_embed(`No starboard found`));
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
  permissions: (msg) => true,
  responder: async (msg, cmd, client) => {
    let sb = db
      .prepare('SELECT * FROM starboards WHERE server=?')
      .get(msg.guild.id);
    if (sb) {
      if (cmd.action === 'random') {
        let star = db
          .prepare(
            'SELECT * FROM starboard_messages WHERE server=? ORDER BY RANDOM()'
          )
          .get(msg.guild.id);
        let sb_msg;
        try {
          sb_msg = await client.channels.cache
            .get(sb.channel)
            .messages.fetch(star.starboard_message);
        } catch (e) {
          console.log(e);
          db.prepare('DELETE FROM starboard_messages WHERE message=?').run(
            star.message
          );
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
};
