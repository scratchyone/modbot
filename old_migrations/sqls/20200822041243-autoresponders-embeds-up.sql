DROP TABLE autoresponders;
CREATE TABLE autoresponders (
    prompt TEXT NOT NULL,
    type TEXT NOT NULL,
    text_response TEXT,
    embed_title TEXT,
    embed_description TEXT,
    server TEXT NOT NULL,
    PRIMARY KEY (prompt, server)
)