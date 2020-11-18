exports.up = function (knex) {
  return knex.schema.dropTable('updates');
};

exports.down = function (knex) {
  return knex.schema.raw(`
    CREATE TABLE updates (
    version TEXT NOT NULL,
    PRIMARY KEY (version)
    );`);
};
