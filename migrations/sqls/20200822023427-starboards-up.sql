CREATE TABLE starboards (
    channel TEXT NOT NULL,
    server TEXT NOT NULL,
    stars  INT NOT NULL,
    PRIMARY KEY (server)
);
CREATE TABLE starboard_messages (
    message TEXT NOT NULL,
    starboard_message TEXT NOT NULL,
    server TEXT NOT NULL,
    PRIMARY KEY (message)
);