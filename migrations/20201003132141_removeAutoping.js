exports.up = function (knex) {
  return knex.schema.dropTable('autopings');
};

exports.down = function (knex) {
  return knex.schema.raw(`
CREATE TABLE autopings (
channel TEXT NOT NULL,
message TEXT NOT NULL,
PRIMARY KEY (channel)
);`);
};
