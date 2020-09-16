const db = require('better-sqlite3')('perms.db3', {});
let util_functions = require('../util_functions.js');
const alertchannels = require('./alertchannels.js');
let setupmute = {
  name: 'setupmute',
  syntax: 'm: setupmute',
  explanation: 'Configure mutes',
  long_explanation:
    'Create/Delete the mute role, and fix its channel permissions if they get changed',
  matcher: (cmd) => cmd.command == 'setupmute',
  permissions: (msg) => msg.member.hasPermission('MANAGE_ROLES'),
  responder: async (msg, cmd) => {
    if (
      !db.prepare('SELECT * FROM mute_roles WHERE server=?').get(msg.guild.id)
    ) {
      let res = await util_functions.embed_options(
        'What do you want to setup?',
        ['Create Mute Role'],
        ['🔨'],
        msg
      );
      if (res === 0) {
        util_functions.assertHasPerms(msg.guild, [
          'MANAGE_ROLES',
          'MANAGE_CHANNELS',
        ]);
        await msg.channel.send('What should the mute role be named?');
        let rolename = await msg.channel.awaitMessages(
          (m) => m.author.id == msg.author.id,
          {
            max: 1,
            time: 20000,
          }
        );
        if (!rolename.array().length) {
          await msg.channel.send(util_functions.desc_embed('Timed out'));
          return;
        }
        let mute_role;
        try {
          mute_role = await msg.guild.roles.create({
            data: {
              name: rolename.array()[0].content,
            },
            reason: 'Created mute role',
          });
        } catch (e) {
          throw new util_functions.BotError(
            'bot',
            'Failed to create mute role!'
          );
        }
        await msg.channel.send(
          util_functions.desc_embed('Setting channel overrides')
        );
        let guild_channels = msg.guild.channels.cache.array();
        for (channel of guild_channels) {
          try {
            await channel.updateOverwrite(mute_role, { SEND_MESSAGES: false });
          } catch (e) {
            await msg.channel.send(
              util_functions.desc_embed(
                `Warning: Could not setup mute role in ${channel}. This likely means ModBot's permissions have an issue`
              )
            );
          }
        }
        db.prepare('INSERT INTO mute_roles VALUES (?, ?)').run(
          mute_role.id,
          msg.guild.id
        );
        await msg.channel.send(
          util_functions.desc_embed(`Created ${mute_role}`)
        );
      }
    } else {
      let res = await util_functions.embed_options(
        'What do you want to setup?',
        ['Remove Mute Role', 'Fix Mute Role Channel Overrides'],
        ['🗑️', '🔨'],
        msg
      );
      if (res === 0) {
        util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
        let conf = await util_functions.confirm(msg);
        if (conf) {
          let mute_role_db = db
            .prepare('SELECT * FROM mute_roles WHERE server=?')
            .get(msg.guild.id);
          let mute_role = msg.guild.roles.cache.get(mute_role_db.role);
          try {
            await mute_role.delete();
          } catch (e) {}
          db.prepare('DELETE FROM mute_roles WHERE server=?').run(msg.guild.id);
          await msg.channel.send(
            util_functions.desc_embed('Deleted mute role and unmuted all')
          );
        }
      } else if (res === 1) {
        util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
        let mute_role_db = db
          .prepare('SELECT * FROM mute_roles WHERE server=?')
          .get(msg.guild.id);
        let mute_role = msg.guild.roles.cache.get(mute_role_db.role);
        let guild_channels = msg.guild.channels.cache.array();
        for (channel of guild_channels) {
          try {
            await channel.updateOverwrite(mute_role, { SEND_MESSAGES: false });
          } catch (e) {
            await msg.channel.send(
              util_functions.desc_embed(
                `Warning: Could not setup mute role in ${channel}. This likely means ModBot's permissions have an issue`
              )
            );
          }
        }
        await msg.channel.send(
          util_functions.desc_embed(`Updated permissions for ${mute_role}`)
        );
      }
    }
  },
};
function checkChannelsThingCanTalkIn(guild, member) {
  return guild.channels.cache
    .array()
    .filter(
      (channel) =>
        channel.permissionsFor(member).has('SEND_MESSAGES') &&
        channel.permissionsFor(member).has('VIEW_CHANNEL')
    );
}
function checkChannelsThingCanTalkInAlways(guild, thing) {
  return guild.channels.cache.array().filter((channel) => {
    let po = channel.permissionOverwrites.get(thing.id);
    return po ? po.allow.has('SEND_MESSAGES') : false;
  });
}
let mute = {
  name: 'mute',
  syntax: 'm: mute <USER> [DURATION]',
  explanation: 'Mute a user',
  long_explanation:
    'Mute a user. [DURATION] is an optional duration in the form `5m`',
  matcher: (cmd) => cmd.command == 'mute',
  permissions: (msg) => msg.member.hasPermission('MANAGE_ROLES'),
  responder: async (msg, cmd) => {
    util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
    if (
      db.prepare('SELECT * FROM mute_roles WHERE server=?').get(msg.guild.id)
    ) {
      let mute_role_db = db
        .prepare('SELECT * FROM mute_roles WHERE server=?')
        .get(msg.guild.id);
      let mute_role = msg.guild.roles.cache.get(mute_role_db.role);
      let mutee = msg.guild.members.cache.get(cmd.user);
      if (mutee.roles.highest.position >= msg.member.roles.highest.position) {
        await msg.channel.send(
          util_functions.desc_embed(
            'The user you are trying to mute is either above you or at the same level as you. You must be above them to mute'
          )
        );
      } else {
        mutee.roles.add(mute_role);
        if (cmd.duration) {
          util_functions.schedule_event(
            {
              type: 'unmute',
              channel: msg.channel.id,
              user: mutee.id,
              server: msg.guild.id,
              role: mute_role.id,
            },
            cmd.duration
          );
          await msg.channel.send(
            util_functions.desc_embed(`Muted ${mutee} for ${cmd.duration}`)
          );
        } else {
          await msg.channel.send(
            util_functions.desc_embed(`Muted ${mutee} indefinitely`)
          );
        }
        let userCanTalkIn = checkChannelsThingCanTalkIn(msg.guild, mutee);
        if (userCanTalkIn.length > 0) {
          if (alertchannels.check_for_alert_channel.get(msg.guild.id)) {
            try {
              let reason = '';
              if (checkChannelsThingCanTalkIn(msg.guild, mute_role).length) {
                let chans = checkChannelsThingCanTalkIn(msg.guild, mute_role);
                reason += `In ${chans.join(
                  ' and '
                )}, the mute role isn't setup. To fix this, run the command \`m: setupmute\` and select the "Fix Mute Role Channel Overrides" option.\n`;
              }
              let role_allows = [];
              for (let role of mutee.roles.cache.array()) {
                if (
                  checkChannelsThingCanTalkInAlways(msg.guild, role).length &&
                  role.id !== msg.guild.id
                ) {
                  let chans = checkChannelsThingCanTalkInAlways(
                    msg.guild,
                    role
                  );
                  role_allows.push({ role: role, chans: chans });
                }
              }
              for (let allow of role_allows) {
                reason += `In ${allow.chans.join(' and ')}, ${
                  allow.role
                } has a permission override. You can fix this in the channel settings\n`;
              }
              if (checkChannelsThingCanTalkInAlways(msg.guild, mutee).length) {
                let chans = checkChannelsThingCanTalkInAlways(msg.guild, mutee);
                reason += `In ${chans.join(
                  ' and '
                )}, ${mutee} has a permission override. You can fix this in the channel settings\n`;
              }
              await msg.guild.channels.cache
                .get(
                  alertchannels.check_for_alert_channel.get(msg.guild.id)
                    .channel
                )
                .send({
                  content: `${msg.author}`,
                  embed: util_functions.desc_embed(
                    `Warning: Muted user ${mutee} can still talk in ${userCanTalkIn.join(
                      ' and '
                    )}.\nReasons:\n${reason}`
                  ),
                });
            } catch (e) {
              console.log(e);
            }
          }
        }
      }
    } else {
      await msg.channel.send(
        util_functions.desc_embed(
          'No mute role! Create one with `m: setupmute`'
        )
      );
    }
  },
};
let unmute = {
  name: 'unmute',
  syntax: 'm: unmute <USER>',
  explanation: 'Unmute a user',
  long_explanation: 'Unmute a user',
  matcher: (cmd) => cmd.command == 'unmute',
  permissions: (msg) => msg.member.hasPermission('MANAGE_ROLES'),
  responder: async (msg, cmd) => {
    util_functions.assertHasPerms(msg.guild, ['MANAGE_ROLES']);
    if (
      db.prepare('SELECT * FROM mute_roles WHERE server=?').get(msg.guild.id)
    ) {
      let mute_role_db = db
        .prepare('SELECT * FROM mute_roles WHERE server=?')
        .get(msg.guild.id);
      let mute_role = msg.guild.roles.cache.get(mute_role_db.role);
      let mutee = msg.guild.members.cache.get(cmd.user);
      if (mutee.roles.highest.position >= msg.member.roles.highest.position) {
        await msg.channel.send(
          util_functions.desc_embed(
            'The user you are trying to unmute is either above you or at the same level as you. You must be above them to unmute'
          )
        );
      } else {
        await mutee.roles.remove(mute_role);
        await msg.channel.send(util_functions.desc_embed(`Unmuted ${mutee}`));
      }
    } else {
      await msg.channel.send(
        util_functions.desc_embed(
          'No mute role! Create one with `m: setupmute`'
        )
      );
    }
  },
};
exports.getMuteRole = db.prepare('SELECT * FROM mute_roles WHERE server=?');
exports.onChannelCreate = async (channel) => {
  let mr = exports.getMuteRole.get(channel.guild.id);
  if (mr) {
    let mute_role = channel.guild.roles.cache.get(mr.role);
    channel.updateOverwrite(mute_role, { SEND_MESSAGES: false });
  }
};
exports.commandModule = {
  title: 'Mutes',
  description:
    'Commands related to muting people and configuring the mute role',
  commands: [setupmute, mute, unmute],
};
