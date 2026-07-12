/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = function(knex) {
    return knex.schema.createTable('sessions', (table)=> {
    table.increments('id').primary();
    table.string('room_code').notNullable().unique();
    table.integer('host_user_id').references('id').inTable('users');
    table.string('name');
    table.boolean('is_public').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  
});
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = function(knex) {
    return knex.schema.dropTable('sessions');
  
};
