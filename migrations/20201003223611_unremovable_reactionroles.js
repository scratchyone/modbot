exports.up = function (knex) {
  return knex.schema.table('reactionroles', function (table) {
    table.int('removable').notNullable().default(1);
  });
};

exports.down = function (knex) {
  return knex.schema.table('reactionroles', function (table) {
    table.dropColumn('removable');
  });
};
