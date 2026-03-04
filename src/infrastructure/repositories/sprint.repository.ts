import db from '@config/database';

export interface Sprint {
    id: string;
    project_id: string;
    name: string;
    goal?: string;
    status: 'todo' | 'in_progress' | 'done';
    start_date: string;
    end_date: string;
    progress: number;
    project_name?: string;
}

export interface MigrateTaskDTO {
    taskId: string;
    fromSprintId: string;
    toSprintId: string;
    reason: string;
    migratedBy: string;
}

export class SprintRepository {

    /** Lista todos los sprints con nombre de proyecto. Soporta filtros opcionales. */
    async findAll(filters?: { projectId?: string; status?: string }): Promise<Sprint[]> {
        let q = db('sprints')
            .select(
                'sprints.*',
                db.raw(`(SELECT name FROM projects WHERE id = sprints.project_id) as project_name`)
            );
        if (filters?.projectId) q = q.where('sprints.project_id', filters.projectId);
        if (filters?.status) q = q.where('sprints.status', filters.status);
        return q.orderBy('sprints.start_date', 'desc');
    }

    async findByProject(projectId: string): Promise<Sprint[]> {
        return db('sprints').where({ project_id: projectId }).orderBy('start_date', 'asc');
    }

    async findById(id: string): Promise<Sprint | null> {
        const sprint = await db('sprints')
            .select('sprints.*', db.raw(`(SELECT name FROM projects WHERE id = sprints.project_id) as project_name`))
            .where('sprints.id', id).first();
        if (!sprint) return null;
        sprint.tasks = await db('tasks')
            .where('sprint_id', id)
            .leftJoin('users', 'tasks.assignee_id', 'users.id')
            .select('tasks.*', 'users.name as assignee_name', 'users.role as assignee_role');
        sprint.migrations = await db('task_migrations')
            .where('from_sprint_id', id).orWhere('to_sprint_id', id);
        return sprint;
    }

    /**
     * Smart create:
     * 1. Busca sprint in_progress para el proyecto.
     * 2. Si existe → lo cierra (done) y migra tareas pendientes al nuevo sprint con trazabilidad.
     * 3. Crea el nuevo sprint con status in_progress.
     * Retorna { sprint, closedSprint } — closedSprint es null si no había sprint activo.
     */
    async create(data: Omit<Sprint, 'id' | 'progress'>, migratedBy?: string): Promise<{ sprint: Sprint; closedSprint: Sprint | null }> {
        const existingActive = await db('sprints')
            .where({ project_id: data.project_id, status: 'in_progress' })
            .first();

        return db.transaction(async (trx) => {
            let closedSprint: Sprint | null = null;

            if (existingActive) {
                // ── Snapshot histórico ── capturar ANTES de migrar tareas ──────
                const allTasks = await trx('tasks').where('sprint_id', existingActive.id);
                const totalTasks = allTasks.length;
                const doneTasks = allTasks.filter((t: any) => t.status === 'done').length;
                const pendingTasks = allTasks.filter((t: any) =>
                    t.status === 'todo' || t.status === 'in_progress'
                );
                const snapshotProgress = totalTasks > 0
                    ? Math.round((doneTasks / totalTasks) * 100)
                    : 0;

                // Cierra el sprint activo + guarda snapshot congelado
                const [closed] = await trx('sprints')
                    .where('id', existingActive.id)
                    .update({
                        status: 'done',
                        updated_at: trx.fn.now(),
                        snapshot_total: totalTasks,
                        snapshot_done: doneTasks,
                        snapshot_migrated: pendingTasks.length,
                        snapshot_progress: snapshotProgress,
                    })
                    .returning('*');
                closedSprint = closed;

                // Crea el nuevo sprint siempre como in_progress
                const [sprint] = await trx('sprints')
                    .insert({ ...data, status: 'in_progress', progress: 0 })
                    .returning('*');

                // Migra tareas pendientes al nuevo sprint con trazabilidad
                for (const task of pendingTasks) {
                    await trx('tasks').where('id', task.id).update({ sprint_id: sprint.id });
                    await trx('task_migrations').insert({
                        task_id: task.id,
                        from_sprint_id: existingActive.id,
                        to_sprint_id: sprint.id,
                        reason: `Heredada automáticamente al cerrar sprint "${existingActive.name}"`,
                        migrated_by: migratedBy || null,
                        migrated_at: trx.fn.now(),
                    });
                }

                // Recalcula progreso del sprint NUEVO (el cerrado queda con snapshot congelado)
                await this._recalc(trx, sprint.id);
                return { sprint, closedSprint };
            }

            // Sin sprint activo previo — crea directamente como in_progress
            const [sprint] = await trx('sprints')
                .insert({ ...data, status: 'in_progress', progress: 0 })
                .returning('*');
            return { sprint, closedSprint: null };
        });
    }

    async update(id: string, data: Partial<Sprint>): Promise<Sprint> {
        const [sprint] = await db('sprints').where({ id })
            .update({ ...data, updated_at: new Date() }).returning('*');
        await this.recalcProgress(id);
        return sprint;
    }

    async delete(id: string): Promise<void> {
        await db('sprints').where({ id }).delete();
    }

    async migrateTask({ taskId, fromSprintId, toSprintId, reason, migratedBy }: MigrateTaskDTO): Promise<void> {
        await db.transaction(async (trx) => {
            await trx('tasks').where('id', taskId).update({ sprint_id: toSprintId, status: 'todo' });
            await trx('task_migrations').insert({
                task_id: taskId, from_sprint_id: fromSprintId, to_sprint_id: toSprintId,
                reason, migrated_by: migratedBy, migrated_at: new Date()
            });
        });
        await this.recalcProgress(fromSprintId);
        await this.recalcProgress(toSprintId);
    }

    async recalcProgress(id: string): Promise<void> {
        await this._recalc(db, id);
    }

    private async _recalc(conn: any, id: string): Promise<void> {
        const stats = await conn('tasks').where('sprint_id', id)
            .select(conn.raw('COUNT(*) as total'), conn.raw(`SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done`))
            .first();
        const progress = Number(stats.total) > 0
            ? Math.round((Number(stats.done) / Number(stats.total)) * 100)
            : 0;
        await conn('sprints').where('id', id).update({ progress });
    }
}
