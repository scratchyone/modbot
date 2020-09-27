exports.up = function (knex) {
  return knex.schema.dropTable('migrations');
};

exports.down = function (knex) {
  throw new Error("Initial Migration Can't be undone, data would be lost");
};
