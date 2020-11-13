exports.up = function (knex) {
  return knex.schema.createTable('defers', function (table) {
    table.string('id').unique().primary().notNullable();
    table.string('data').notNullable();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('defers');
};
