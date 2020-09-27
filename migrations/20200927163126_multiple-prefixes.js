exports.up = function (knex) {
  return knex.schema.table('prefixes', function (table) {
    table.dropUnique('server');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('prefixes', function (table) {
    table.unique('server');
  });
};
