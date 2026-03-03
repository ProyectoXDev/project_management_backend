import db from '@config/database';

export interface Project {
    id: string;
    name: string;
    description?: string;
    pm_id?: string;
    start_date: string;
    end_date?: string;
    type: 'closed' | 'open';
    priority_score: number;
    progress: number;
    created_at: Date;
    updated_at: Date;
}

export interface CreateProjectDTO {
    name: string;
    description?: string;
    pm_id?: string;
    start_date: string;
    end_date?: string;
    type: 'closed' | 'open';
    member_ids?: string[];
}

export class ProjectRepository {
    async findAll(filters?: { type?: string; pmId?: string }): Promise<Project[]> {
        let q = db('projects').select('projects.*',
            db.raw(`(SELECT name FROM users WHERE id = projects.pm_id) as pm_name`)
        );
        if (filters?.type) q = q.where('projects.type', filters.type);
        if (filters?.pmId) q = q.where('projects.pm_id', filters.pmId);
        return q.orderBy('priority_score', 'desc');
    }

    async findById(id: string): Promise<Project | null> {
        const project = await db('projects')
            .select('projects.*', db.raw(`(SELECT name FROM users WHERE id = projects.pm_id) as pm_name`))
            .where('projects.id', id).first();
        if (!project) return null;
        project.members = await db('project_members')
            .join('users', 'project_members.user_id', 'users.id')
            .where('project_members.project_id', id)
            .select('users.id', 'users.name', 'users.email', 'users.role', 'project_members.capacity_pct');
        return project;
    }

    async create(data: CreateProjectDTO): Promise<Project> {
        const { member_ids, ...projectData } = data;
        const [project] = await db('projects').insert(projectData).returning('*');
        if (member_ids?.length) {
            await db('project_members').insert(
                member_ids.map((uid) => ({ project_id: project.id, user_id: uid, capacity_pct: 100 }))
            );
        }
        return project;
    }

    async update(id: string, data: Partial<CreateProjectDTO>): Promise<Project> {
        const { member_ids, ...projectData } = data;
        const [project] = await db('projects').where({ id })
            .update({ ...projectData, updated_at: new Date() }).returning('*');
        if (member_ids) {
            await db('project_members').where('project_id', id).delete();
            if (member_ids.length) {
                await db('project_members').insert(
                    member_ids.map((uid) => ({ project_id: id, user_id: uid, capacity_pct: 100 }))
                );
            }
        }
        return project;
    }

    async delete(id: string): Promise<void> {
        await db('projects').where({ id }).delete();
    }

    async recalcProgress(id: string): Promise<void> {
        const stats = await db('tasks').where('project_id', id)
            .select(db.raw('COUNT(*) as total'), db.raw(`SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done`)).first();
        const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
        const daysLeft = await db('projects').where('id', id).select('end_date').first();
        const diffDays = daysLeft?.end_date
            ? Math.max(0, Math.ceil((new Date(daysLeft.end_date).getTime() - Date.now()) / 86400000))
            : 999;
        const urgency = diffDays < 7 ? 30 : diffDays < 30 ? 20 : diffDays < 90 ? 10 : 0;
        const pendingPct = 100 - progress;
        const priorityScore = Math.min(100, pendingPct * 0.7 + urgency);
        await db('projects').where('id', id).update({ progress, priority_score: priorityScore });
    }
}
