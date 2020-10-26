exports.up = function (knex) {
  return knex.schema.table('capabilities', function (table) {
    table.unique('token');
  });
};

exports.down = function (knex) {
  return knex.schema.table('capabilities', function (table) {
    table.dropUnique('token');
  });
};
