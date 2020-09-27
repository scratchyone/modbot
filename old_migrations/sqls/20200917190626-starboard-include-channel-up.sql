DROP TABLE starboard_messages;
CREATE TABLE starboard_messages (
    message TEXT NOT NULL,
    starboard_message TEXT NOT NULL,
    server TEXT NOT NULL,
    starboard_message_channel TEXT NOT NULL,
    message_channel TEXT NOT NULL,
    PRIMARY KEY (message)
);