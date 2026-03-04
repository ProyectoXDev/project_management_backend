import { Knex } from 'knex';

// Agrega columnas de snapshot histórico al cerrar un sprint.
// Son todas nullable para no afectar sprints existentes ni activos.
export async function up(knex: Knex): Promise<void> {
    const hasTotal = await knex.schema.hasColumn('sprints', 'snapshot_total');
    if (!hasTotal) {
        await knex.schema.alterTable('sprints', (t) => {
            t.integer('snapshot_total').nullable().comment('Total tareas al momento de cierre');
            t.integer('snapshot_done').nullable().comment('Tareas finalizadas al cierre');
            t.integer('snapshot_migrated').nullable().comment('Tareas heredadas al siguiente sprint');
            t.decimal('snapshot_progress', 5, 2).nullable().comment('% avance congelado al cierre — no se recalcula');
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('sprints', (t) => {
        t.dropColumn('snapshot_total');
        t.dropColumn('snapshot_done');
        t.dropColumn('snapshot_migrated');
        t.dropColumn('snapshot_progress');
    });
}
