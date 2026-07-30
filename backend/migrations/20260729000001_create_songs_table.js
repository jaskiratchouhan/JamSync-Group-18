export const up = function(knex) {
    return knex.schema.createTable('songs', (table) => {
        table.increments('id').primary();
        table.string('title').notNullable();
        table.string('artist');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

export const down = function(knex) {
    return knex.schema.dropTable('songs');
};
