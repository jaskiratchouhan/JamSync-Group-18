/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = function(knex) {
    return knex.schema.createTable('friends', (table) => {
        table.increments('id').primary();
        table.integer('requester_id').references('id').inTable('users').notNullable();
        table.integer('requestee_id').references('id').inTable('users').notNullable();
        table.string('status').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
    })
  
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = function(knex) {
    return knex.schema.dropTable('friends');
  
};
