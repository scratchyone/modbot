exports.up = function (knex) {
  return knex.schema.raw(`CREATE TABLE anonchannels (
    id TEXT NOT NULL,
    server TEXT NOT NULL,
    PRIMARY KEY (id, server)
);`).raw(`
CREATE TABLE anonbans (
    user TEXT NOT NULL,
    server TEXT NOT NULL,
    PRIMARY KEY (user, server)
);`).raw(`
CREATE TABLE timerevents (
    timestamp BIGINT NOT NULL,
    event TEXT NOT NULL
);`).raw(`
CREATE TABLE pinners (
    roleid TEXT NOT NULL,
    guild TEXT NOT NULL,
    PRIMARY KEY (roleid, guild)
);`).raw(`
CREATE TABLE anonmessages (
    id TEXT NOT NULL,
    user TEXT NOT NULL,
    server TEXT NOT NULL,
    PRIMARY KEY (id, user, server)
);`).raw(`
CREATE TABLE starboards (
    channel TEXT NOT NULL,
    server TEXT NOT NULL,
    stars  INT NOT NULL,
    PRIMARY KEY (server)
);`).raw(`
CREATE TABLE autoresponders (
    prompt TEXT NOT NULL,
    type TEXT NOT NULL,
    text_response TEXT,
    embed_title TEXT,
    embed_description TEXT,
    server TEXT NOT NULL,
    PRIMARY KEY (prompt, server)
);`).raw(`
CREATE TABLE reactionroles (
    message TEXT NOT NULL,
    server TEXT NOT NULL,
    emoji TEXT NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (message, emoji, server)
);`).raw(`
CREATE TABLE mute_roles (
    role TEXT NOT NULL,
    server TEXT NOT NULL,
    PRIMARY KEY (server)
);`).raw(`
CREATE TABLE notes (
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    user TEXT NOT NULL,
    server TEXT NOT NULL,
    id TEXT NOT NULL,
    PRIMARY KEY (id)
);`).raw(`
CREATE TABLE alert_channels (
server TEXT NOT NULL,
channel TEXT NOT NULL,
PRIMARY KEY (server)
);`).raw(`
CREATE TABLE alert_channels_ignore (
server TEXT NOT NULL,
PRIMARY KEY (server)
);`).raw(`
CREATE TABLE join_roles (
server TEXT NOT NULL,
role   TEXT NOT NULL,
PRIMARY KEY (server)
);`).raw(`
CREATE TABLE locked_channels (
channel TEXT NOT NULL,
permissions TEXT NOT NULL,
PRIMARY KEY (channel)
);`).raw(`
CREATE TABLE autopings (
channel TEXT NOT NULL,
message TEXT NOT NULL,
PRIMARY KEY (channel)
);`).raw(`
CREATE TABLE polls (
message TEXT NOT NULL,
PRIMARY KEY (message)
);`).raw(`
CREATE TABLE updates (
version TEXT NOT NULL,
PRIMARY KEY (version)
);`).raw(`
CREATE TABLE automods (
server TEXT NOT NULL,
channel TEXT NOT NULL,
PRIMARY KEY (server)
);`).raw(`
CREATE TABLE automod_triggers (
server TEXT NOT NULL,
setuprole TEXT NOT NULL,
name TEXT NOT NULL,
regex TEXT NOT NULL,
punishments TEXT NOT NULL,
PRIMARY KEY (server, name)
);`).raw(`
CREATE TABLE starboard_messages (
    message TEXT NOT NULL,
    starboard_message TEXT NOT NULL,
    server TEXT NOT NULL,
    starboard_message_channel TEXT NOT NULL,
    message_channel TEXT NOT NULL,
    PRIMARY KEY (message)
);`).raw(`
CREATE TABLE slowmodes (
channel TEXT NOT NULL,
time INTEGER NOT NULL,
delete_mm INTEGER NOT NULL,
PRIMARY KEY (channel)
);`).raw(`
CREATE TABLE slowmoded_users (
channel TEXT NOT NULL,
user TEXT NOT NULL,
PRIMARY KEY(channel, user)
);`);
};

exports.down = function (knex) {
  return knex.schema
    .dropTable('anonchannels')
    .dropTable('anonbans')
    .dropTable('pinners')
    .dropTable('anonmessages')
    .dropTable('starboards')
    .dropTable('autoresponders')
    .dropTable('reactionroles')
    .dropTable('mute_roles')
    .dropTable('notes')
    .dropTable('alert_channels')
    .dropTable('alert_channels_ignore')
    .dropTable('join_roles')
    .dropTable('locked_channels')
    .dropTable('autopings')
    .dropTable('polls')
    .dropTable('timerevents')
    .dropTable('updates')
    .dropTable('automods')
    .dropTable('automod_triggers')
    .dropTable('starboard_messages')
    .dropTable('slowmodes')
    .dropTable('slowmoded_users');
};
