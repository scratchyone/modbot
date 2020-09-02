DROP TABLE autoresponders;
CREATE TABLE autoresponders (
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    server TEXT NOT NULL,
    PRIMARY KEY (prompt)
)