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
}

export interface MigrateTaskDTO {
    taskId: string;
    fromSprintId: string;
    toSprintId: string;
    reason: string;
    migratedBy: string;
}

export class SprintRepository {
    async findByProject(projectId: string): Promise<Sprint[]> {
        return db('sprints').where({ project_id: projectId }).orderBy('start_date', 'asc');
    }

    async findById(id: string): Promise<Sprint | null> {
        const sprint = await db('sprints').where({ id }).first();
        if (!sprint) return null;
        sprint.tasks = await db('tasks').where('sprint_id', id)
            .join('users', 'tasks.assignee_id', 'users.id')
            .select('tasks.*', 'users.name as assignee_name');
        sprint.migrations = await db('task_migrations').where('from_sprint_id', id)
            .orWhere('to_sprint_id', id);
        return sprint;
    }

    async create(data: Omit<Sprint, 'id' | 'progress'>): Promise<Sprint> {
        const [sprint] = await db('sprints').insert({ ...data, progress: 0 }).returning('*');
        return sprint;
    }

    async update(id: string, data: Partial<Sprint>): Promise<Sprint> {
        const [sprint] = await db('sprints').where({ id })
            .update({ ...data, updated_at: new Date() }).returning('*');
        return sprint;
    }

    async delete(id: string): Promise<void> {
        await db('sprints').where({ id }).delete();
    }

    async migrateTask({ taskId, fromSprintId, toSprintId, reason, migratedBy }: MigrateTaskDTO): Promise<void> {
        await db.transaction(async (trx) => {
            await trx('tasks').where('id', taskId).update({ sprint_id: toSprintId, status: 'todo' });
            await trx('task_migrations').insert({ task_id: taskId, from_sprint_id: fromSprintId, to_sprint_id: toSprintId, reason, migrated_by: migratedBy, migrated_at: new Date() });
        });
    }

    async recalcProgress(id: string): Promise<void> {
        const stats = await db('tasks').where('sprint_id', id)
            .select(db.raw('COUNT(*) as total'), db.raw(`SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done`)).first();
        const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
        await db('sprints').where('id', id).update({ progress });
    }
}
