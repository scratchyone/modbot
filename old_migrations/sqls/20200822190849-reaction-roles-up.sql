CREATE TABLE reactionroles (
    message TEXT NOT NULL,
    server TEXT NOT NULL,
    emoji TEXT NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (message, emoji, server)
)