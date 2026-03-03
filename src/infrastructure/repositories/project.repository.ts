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
    status: 'active' | 'inactive';
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
    // Permite especificar capacidad individual por miembro
    members?: { user_id: string; capacity_pct: number }[];
}

export class ProjectRepository {
    async findAll(filters?: { type?: string; pmId?: string; includeInactive?: boolean | string; status?: string }): Promise<Project[]> {
        // Coerce includeInactive: query params llegan como string 'true'
        const showAll = filters?.includeInactive === true || filters?.includeInactive === 'true';
        const statusFilter = filters?.status; // 'active' | 'inactive' | undefined

        let q = db('projects').select(
            'projects.*',
            db.raw(`(SELECT name FROM users WHERE id = projects.pm_id) as pm_name`),
            // Punto 1: members como JSON agregado — evita N+1 y lleva equipo en findAll
            db.raw(`
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'id', u.id, 'name', u.name, 'role', u.role, 'capacity_pct', pm.capacity_pct
                    ))
                    FROM project_members pm
                    JOIN users u ON u.id = pm.user_id
                    WHERE pm.project_id = projects.id),
                '[]'::json) as members
            `)
        );

        // Punto 3: filtrado por status
        if (statusFilter) {
            q = q.where('projects.status', statusFilter);
        } else if (!showAll) {
            q = q.where('projects.status', 'active');
        }

        if (filters?.type) q = q.where('projects.type', filters.type);
        if (filters?.pmId) q = q.where('projects.pm_id', filters.pmId);

        // Punto 3: activos primero, luego por created_at desc
        return q
            .orderByRaw(`CASE WHEN projects.status = 'active' THEN 0 ELSE 1 END`)
            .orderBy('projects.created_at', 'desc');
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
        // Sprint activo del proyecto
        project.active_sprint = await db('sprints')
            .where({ project_id: id, status: 'in_progress' })
            .select('id', 'name', 'status', 'progress', 'start_date', 'end_date')
            .first() || null;
        return project;
    }

    async create(data: CreateProjectDTO): Promise<Project> {
        const { member_ids, members, ...projectData } = data;

        // Transacción: si project_members falla, revierte también el INSERT de projects
        return db.transaction(async (trx) => {
            const [project] = await trx('projects').insert(projectData).returning('*');

            // Filtra entradas con user_id vacío o nulo (pueden llegar del selector sin selección)
            const validMembers = (members ?? []).filter(m => m.user_id && String(m.user_id).trim() !== '');
            const validIds = (member_ids ?? []).filter(uid => uid && String(uid).trim() !== '');

            if (validMembers.length) {
                await trx('project_members').insert(
                    validMembers.map(m => ({ project_id: project.id, user_id: m.user_id, capacity_pct: m.capacity_pct ?? 100 }))
                );
            } else if (validIds.length) {
                await trx('project_members').insert(
                    validIds.map(uid => ({ project_id: project.id, user_id: uid, capacity_pct: 100 }))
                );
            }

            return project;
        });
    }

    async update(id: string, data: Partial<CreateProjectDTO>): Promise<Project> {
        const { member_ids, members, ...projectData } = data;
        const [project] = await db('projects').where({ id })
            .update({ ...projectData, updated_at: new Date() }).returning('*');
        if (members !== undefined) {
            await db('project_members').where('project_id', id).delete();
            if (members.length) {
                await db('project_members').insert(
                    members.map(m => ({ project_id: id, user_id: m.user_id, capacity_pct: m.capacity_pct ?? 100 }))
                );
            }
        } else if (member_ids !== undefined) {
            await db('project_members').where('project_id', id).delete();
            if (member_ids.length) {
                await db('project_members').insert(
                    member_ids.map(uid => ({ project_id: id, user_id: uid, capacity_pct: 100 }))
                );
            }
        }
        return project;
    }

    /**
     * Punto 4: Verifica asociaciones antes de eliminar.
     * - Con asociaciones → marca status='inactive' (soft delete).
     * - Sin asociaciones → eliminación física.
     * Devuelve { action: 'deactivated' | 'deleted' }
     */
    async safeDelete(id: string): Promise<{ action: 'deactivated' | 'deleted' }> {
        const [taskCount, sprintCount] = await Promise.all([
            db('tasks').where('project_id', id).count('id as c').first(),
            db('sprints').where('project_id', id).count('id as c').first(),
        ]);
        const hasAssociations =
            Number((taskCount as any)?.c) > 0 ||
            Number((sprintCount as any)?.c) > 0;

        if (hasAssociations) {
            // Solo cambia status — no toca datos relacionados
            await db('projects')
                .where({ id })
                .update({ status: 'inactive', updated_at: db.fn.now() });
            return { action: 'deactivated' };
        }
        await db('projects').where({ id }).delete();
        return { action: 'deleted' };
    }

    /** Reactiva un proyecto inactivo */
    async reactivate(id: string): Promise<void> {
        await db('projects')
            .where({ id })
            .update({ status: 'active', updated_at: db.fn.now() });
    }

    async delete(id: string): Promise<void> {
        await db('projects').where({ id }).delete();
    }

    /**
     * Punto 3: KPI de avance basado en el sprint activo.
     * Si no hay sprint activo, recauda sobre todas las tareas del proyecto (fallback).
     */
    async recalcProgress(id: string): Promise<void> {
        // Buscar sprint activo
        const activeSprint = await db('sprints')
            .where({ project_id: id, status: 'in_progress' }).select('id').first();

        let progress = 0;
        if (activeSprint) {
            const stats = await db('tasks').where('sprint_id', activeSprint.id)
                .select(db.raw('COUNT(*) as total'), db.raw(`SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done`)).first();
            progress = (stats as any).total > 0 ? Math.round(((stats as any).done / (stats as any).total) * 100) : 0;
        } else {
            // Fallback: tareas del proyecto
            const stats = await db('tasks').where('project_id', id)
                .select(db.raw('COUNT(*) as total'), db.raw(`SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done`)).first();
            progress = (stats as any).total > 0 ? Math.round(((stats as any).done / (stats as any).total) * 100) : 0;
        }

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
