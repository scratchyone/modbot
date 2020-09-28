exports.up = function (knex) {
  return knex.schema.createTable('reminders', function (table) {
    table.string('author', 255).notNullable();
    table.string('id', 255).notNullable().unique();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('reminders');
};
