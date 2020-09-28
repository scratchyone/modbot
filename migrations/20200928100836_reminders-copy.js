exports.up = function (knex) {
  return knex.schema.createTable('reminderSubscribers', function (table) {
    table.string('user', 255).notNullable();
    table.string('id', 255).notNullable();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('reminderSubscribers');
};
