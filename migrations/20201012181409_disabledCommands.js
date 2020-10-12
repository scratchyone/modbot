exports.up = function (knex) {
  return knex.schema.createTable('disabledCommands', function (table) {
    table.string('server').notNullable();
    table.string('command').notNullable();
    table.unique(['server', 'command']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('disabledCommands');
};
