DROP TABLE anonmessages;
CREATE TABLE anonmessages (
    id TEXT NOT NULL,
    user TEXT NOT NULL,
    PRIMARY KEY (id, user)
);