exports.up = function (knex) {
  return knex.schema.createTable('logChannels', function (table) {
    table.string('guild').notNullable().unique();
    table.string('channel').notNullable().unique();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('logChannels');
};
