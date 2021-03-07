CREATE TABLE anonchannels (
    id TEXT NOT NULL,
    server TEXT NOT NULL,
    PRIMARY KEY (id, server)
);
CREATE TABLE anonbans (
    user TEXT NOT NULL,
    server TEXT NOT NULL,
    PRIMARY KEY (user, server)
);
CREATE TABLE timerevents (
    timestamp BIGINT NOT NULL,
    event TEXT NOT NULL
);
CREATE TABLE pinners (
    roleid TEXT NOT NULL,
    guild TEXT NOT NULL,
    PRIMARY KEY (roleid, guild)
);
CREATE TABLE anonmessages (
    id TEXT NOT NULL,
    user TEXT NOT NULL,
    server TEXT NOT NULL,
    PRIMARY KEY (id, user, server)
);
CREATE TABLE starboards (
    channel TEXT NOT NULL,
    server TEXT NOT NULL,
    stars  INT NOT NULL,
    PRIMARY KEY (server)
);
CREATE TABLE autoresponders (
    prompt TEXT NOT NULL,
    type TEXT NOT NULL,
    text_response TEXT,
    embed_title TEXT,
    embed_description TEXT,
    server TEXT NOT NULL,
    PRIMARY KEY (prompt, server)
);
CREATE TABLE reactionroles (
    message TEXT NOT NULL,
    server TEXT NOT NULL,
    emoji TEXT NOT NULL,
    role TEXT NOT NULL, `removable` undefined not null default '1',
    PRIMARY KEY (message, emoji, server)
);
CREATE TABLE mute_roles (
    role TEXT NOT NULL,
    server TEXT NOT NULL,
    PRIMARY KEY (server)
);
CREATE TABLE notes (
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    user TEXT NOT NULL,
    server TEXT NOT NULL,
    id TEXT NOT NULL,
    PRIMARY KEY (id)
);
CREATE TABLE alert_channels (
server TEXT NOT NULL,
channel TEXT NOT NULL,
PRIMARY KEY (server)
);
CREATE TABLE alert_channels_ignore (
server TEXT NOT NULL,
PRIMARY KEY (server)
);
CREATE TABLE join_roles (
server TEXT NOT NULL,
role   TEXT NOT NULL,
PRIMARY KEY (server)
);
CREATE TABLE locked_channels (
channel TEXT NOT NULL,
permissions TEXT NOT NULL,
PRIMARY KEY (channel)
);
CREATE TABLE polls (
message TEXT NOT NULL,
PRIMARY KEY (message)
);
CREATE TABLE automods (
server TEXT NOT NULL,
channel TEXT NOT NULL,
PRIMARY KEY (server)
);
CREATE TABLE automod_triggers (
server TEXT NOT NULL,
setuprole TEXT NOT NULL,
name TEXT NOT NULL,
regex TEXT NOT NULL,
punishments TEXT NOT NULL,
PRIMARY KEY (server, name)
);
CREATE TABLE starboard_messages (
    message TEXT NOT NULL,
    starboard_message TEXT NOT NULL,
    server TEXT NOT NULL,
    starboard_message_channel TEXT NOT NULL,
    message_channel TEXT NOT NULL,
    PRIMARY KEY (message)
);
CREATE TABLE slowmodes (
channel TEXT NOT NULL,
time INTEGER NOT NULL,
delete_mm INTEGER NOT NULL
);
CREATE TABLE slowmoded_users (
channel TEXT NOT NULL,
user TEXT NOT NULL,
PRIMARY KEY(channel, user)
);
CREATE TABLE `knex_migrations` (`id` integer not null primary key autoincrement, `name` varchar(255), `batch` integer, `migration_time` datetime);
CREATE TABLE `knex_migrations_lock` (`index` integer not null primary key autoincrement, `is_locked` integer);
CREATE TABLE `prefixes` (`server` varchar(255) not null, `prefix` varchar(10) not null);
CREATE TABLE `reminders` (`author` varchar(255) not null, `id` varchar(255) not null, `text` varchar(255), `time` integer);
CREATE TABLE `reminderSubscribers` (`user` varchar(255) not null, `id` varchar(255) not null);
CREATE TABLE `botMessages` (`guild` varchar(255) not null, `channel` varchar(255) not null, `message` varchar(255) not null, `botMessage` varchar(255) not null);
CREATE TABLE `disabledCommands` (`server` varchar(255) not null, `command` varchar(255) not null);
CREATE TABLE `logChannels` (`guild` varchar(255) not null, `channel` varchar(255) not null);
CREATE TABLE `subscriptions` (`type` varchar(255) not null, `subreddit` varchar(255), `webhookid` varchar(255) not null, `webhooktoken` varchar(255) not null, `guild` varchar(255) not null, `channel` varchar(255) not null);
CREATE TABLE `capabilities` (`token` varchar(255), `user` varchar(255), `type` varchar(255), `expire` integer);
CREATE TABLE `defers` (`id` varchar(255) not null, `data` varchar(255) not null, primary key (`id`));
CREATE UNIQUE INDEX `prefixes_server_prefix_unique` on `prefixes` (`server`, `prefix`);
CREATE UNIQUE INDEX `reminders_id_unique` on `reminders` (`id`);
CREATE UNIQUE INDEX `botmessages_botmessage_unique` on `botMessages` (`botMessage`);
CREATE UNIQUE INDEX `disabledcommands_server_command_unique` on `disabledCommands` (`server`, `command`);
CREATE UNIQUE INDEX `logchannels_guild_unique` on `logChannels` (`guild`);
CREATE UNIQUE INDEX `logchannels_channel_unique` on `logChannels` (`channel`);
CREATE UNIQUE INDEX `subscriptions_webhookid_unique` on `subscriptions` (`webhookid`);
CREATE UNIQUE INDEX `subscriptions_webhooktoken_unique` on `subscriptions` (`webhooktoken`);
CREATE UNIQUE INDEX `capabilities_token_unique` on `capabilities` (`token`);
CREATE UNIQUE INDEX `defers_id_unique` on `defers` (`id`);