exports.up = function (knex) {
  return knex.schema.createTable('subscriptions', function (table) {
    table.string('type').notNullable();
    table.string('subreddit');
    table.string('webhookid').notNullable().unique();
    table.string('webhooktoken').notNullable().unique();
    table.string('guild').notNullable();
    table.string('channel').notNullable();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('subscriptions');
};
