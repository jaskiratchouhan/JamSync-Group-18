export const up = function(knex) {
    return knex.schema.alterTable('users', (table) => {
        table.text('avatar_url').alter();
    });
};

export const down = function(knex) {
    return knex.schema.alterTable('users', (table) => {
        table.string('avatar_url').alter();
    });
};
