/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = function(knex) {
    return knex.schema.createTable('session_members', (table) => {
        table.increments('id').primary();
        table.integer('session_id').references('id').inTable('sessions').onDelete('CASCADE');
        table.integer('user_id').references('id').inTable('users');
        table.timestamp('joined_at').defaultTo(knex.fn.now());
        table.unique(['session_id', 'user_id']);
    })
  
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = function(knex) {
    return knex.schema.dropTable('session_members')
  
};
