exports.up = function (knex) {
  return knex.schema.createTable('prefixes', function (table) {
    table.string('server', 255).notNullable().unique();
    table.string('prefix', 10).notNullable();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('prefixes');
};
