CREATE TABLE anonchannels (
    id TEXT NOT NULL,
    server TEXT NOT NULL,
    PRIMARY KEY (id, server)
);
CREATE TABLE anonmessages (
    id TEXT NOT NULL,
    user TEXT NOT NULL,
    PRIMARY KEY (id, user)
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