exports.up = function (knex) {
  return knex.schema.createTable('capabilities', function (table) {
    table.string('token');
    table.string('user');
    table.string('type');
    table.integer('expire');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('capabilities');
};
