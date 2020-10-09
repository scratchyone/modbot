exports.up = function (knex) {
  return knex.schema.table('reminders', function (table) {
    table.string('text');
    table.integer('time');
  });
};

exports.down = function (knex) {
  return knex.schema.table('reminders', function (table) {
    table.dropColumn('text');
    table.dropColumn('time');
  });
};
