DROP TABLE anonmessages;
CREATE TABLE anonmessages (
    id TEXT NOT NULL,
    user TEXT NOT NULL,
    server TEXT NOT NULL,
    PRIMARY KEY (id, user, server)
);