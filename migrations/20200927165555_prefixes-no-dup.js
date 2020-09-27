exports.up = function (knex) {
  return knex.schema.table('prefixes', function (table) {
    table.unique(['server', 'prefix']);
  });
};

exports.down = function (knex) {
  return knex.schema.table('prefixes', function (table) {
    table.dropUnique(['server', 'prefix']);
  });
};
