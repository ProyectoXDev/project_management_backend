import { Knex } from 'knex';

// Agrega columna status a projects para soportar soft-delete (active/inactive)
export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasColumn('projects', 'status');
    if (!exists) {
        await knex.schema.alterTable('projects', (t) => {
            t.string('status', 20).notNullable().defaultTo('active').index();
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasColumn('projects', 'status');
    if (exists) {
        await knex.schema.alterTable('projects', (t) => {
            t.dropColumn('status');
        });
    }
}
