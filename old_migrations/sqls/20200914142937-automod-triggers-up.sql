CREATE TABLE automod_triggers (
server TEXT NOT NULL,
setuprole TEXT NOT NULL,
name TEXT NOT NULL,
regex TEXT NOT NULL,
punishments TEXT NOT NULL,
PRIMARY KEY (server, name)
)