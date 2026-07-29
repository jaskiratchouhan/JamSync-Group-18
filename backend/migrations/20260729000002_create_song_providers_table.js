export const up = function(knex) {
    return knex.schema.createTable('song_providers', (table) => {
        table.increments('id').primary();
        table.integer('song_id').notNullable().references('id').inTable('songs').onDelete('CASCADE');
        table.string('provider').notNullable();
        table.string('provider_track_id').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.unique(['provider', 'provider_track_id']);
    });
};

export const down = function(knex) {
    return knex.schema.dropTable('song_providers');
};
