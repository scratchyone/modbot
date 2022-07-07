-- DropIndex
DROP INDEX "defers_id_unique";

-- RedefineIndex
DROP INDEX "botmessages_botmessage_unique";
CREATE UNIQUE INDEX "botMessages_botMessage_key" ON "botMessages"("botMessage");

-- RedefineIndex
DROP INDEX "disabledcommands_server_command_unique";
CREATE UNIQUE INDEX "disabledCommands_server_command_key" ON "disabledCommands"("server", "command");

-- RedefineIndex
DROP INDEX "logchannels_channel_unique";
CREATE UNIQUE INDEX "logChannels_channel_key" ON "logChannels"("channel");

-- RedefineIndex
DROP INDEX "logchannels_guild_unique";
CREATE UNIQUE INDEX "logChannels_guild_key" ON "logChannels"("guild");

-- RedefineIndex
DROP INDEX "prefixes_server_prefix_unique";
CREATE UNIQUE INDEX "prefixes_server_prefix_key" ON "prefixes"("server", "prefix");

-- RedefineIndex
DROP INDEX "reminders_id_unique";
CREATE UNIQUE INDEX "reminders_id_key" ON "reminders"("id");

-- RedefineIndex
DROP INDEX "subscriptions_webhooktoken_unique";
CREATE UNIQUE INDEX "subscriptions_webhooktoken_key" ON "subscriptions"("webhooktoken");

-- RedefineIndex
DROP INDEX "subscriptions_webhookid_unique";
CREATE UNIQUE INDEX "subscriptions_webhookid_key" ON "subscriptions"("webhookid");
