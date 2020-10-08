exports.up = function (knex) {
  return knex.schema.createTable('botMessages', function (table) {
    table.string('guild').notNullable();
    table.string('channel').notNullable();
    table.string('message').notNullable();
    table.string('botMessage').notNullable().unique();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('botMessages');
};
