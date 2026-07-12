/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = function(knex) {
    return knex.schema.createTable('users', table =>{
        table.increments('id').primary();
        table.string('platform');
        table.string('email');
        table.string('platform_id');
        table.string('display_name');
        table.string('avatar_url');
        table.text('access_token');
        table.text('refresh_token');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('token_expires_at');
        table.unique(['platform', 'platform_id']);
    })
  
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = function(knex) {
    return knex.schema.dropTable('users');
  
};
