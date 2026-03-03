import db from '@config/database';
import { EmailService } from '@infrastructure/email/email.service';
import { ProjectRepository } from './project.repository';

export interface Task {
    id: string;
    title: string;
    description?: string;
    assignee_id?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    project_id: string;
    sprint_id?: string;
    status: 'todo' | 'in_progress' | 'done';
    estimated_date?: string;
}

export interface CreateTaskDTO {
    title: string;
    description?: string;
    assignee_id?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    project_id: string;
    sprint_id?: string;
    estimated_date?: string;
}

const emailSvc = new EmailService();
const projectRepo = new ProjectRepository();

// Fire-and-forget email helper — never throws, never blocks response
const sendEmailSafe = (fn: () => Promise<void>): void => {
    fn().catch((err: any) => {
        console.warn('[Email] Send failed (non-blocking):', err?.message ?? err);
    });
};

export class TaskRepository {
    async findAll(filters?: { projectId?: string; sprintId?: string; status?: string; priority?: string; assigneeId?: string }): Promise<Task[]> {
        let q = db('tasks')
            .leftJoin('users as assignees', 'tasks.assignee_id', 'assignees.id')
            .leftJoin('projects', 'tasks.project_id', 'projects.id')
            .leftJoin('sprints', 'tasks.sprint_id', 'sprints.id')
            .select(
                'tasks.*',
                'assignees.name as assignee_name',
                'assignees.email as assignee_email',
                'projects.name as project_name',
                'sprints.name as sprint_name'
            );
        if (filters?.projectId) q = q.where('tasks.project_id', filters.projectId);
        if (filters?.sprintId) q = q.where('tasks.sprint_id', filters.sprintId);
        if (filters?.status) q = q.where('tasks.status', filters.status);
        if (filters?.priority) q = q.where('tasks.priority', filters.priority);
        if (filters?.assigneeId) q = q.where('tasks.assignee_id', filters.assigneeId);
        return q.orderBy([{ column: 'tasks.priority', order: 'desc' }, { column: 'tasks.created_at', order: 'desc' }]);
    }

    async findById(id: string): Promise<Task | null> {
        const task = await db('tasks').where('tasks.id', id)
            .leftJoin('users as assignees', 'tasks.assignee_id', 'assignees.id')
            .select('tasks.*', 'assignees.name as assignee_name', 'assignees.email as assignee_email')
            .first();
        if (!task) return null;
        task.comments = await db('task_comments').where('task_id', id)
            .join('users', 'task_comments.author_id', 'users.id')
            .select('task_comments.*', 'users.name as author_name').orderBy('created_at', 'asc');
        task.attachments = await db('task_attachments').where('task_id', id);
        task.history = await db('task_history').where('task_id', id)
            .leftJoin('users', 'task_history.changed_by', 'users.id')
            .select('task_history.*', 'users.name as changed_by_name').orderBy('changed_at', 'asc');
        return task;
    }

    async create(data: CreateTaskDTO, createdBy: string): Promise<Task> {
        const [task] = await db('tasks').insert(data).returning('*');

        // Notify assignee — fire-and-forget (B2 fix: never blocks response)
        if (data.assignee_id) {
            const assignee = await db('users').where('id', data.assignee_id).first();
            if (assignee) {
                sendEmailSafe(() => emailSvc.sendTaskAssigned(assignee.email, assignee.name, task.title));
                // Notification record is fast (DB only) — keep synchronous
                await db('notifications').insert({
                    user_id: assignee.id,
                    message: `New task assigned: ${task.title}`,
                    type: 'task_assigned',
                }).catch(() => {/* ignore dup notif errors */ });
            }
        }

        // B5 fix: recalculate project progress after creating a task
        if (task.project_id) {
            await projectRepo.recalcProgress(task.project_id).catch(() => {/* non-critical */ });
        }

        return task;
    }

    async update(id: string, data: Partial<CreateTaskDTO>, updatedBy: string): Promise<Task> {
        const old = await db('tasks').where('id', id).first();
        const [task] = await db('tasks').where({ id }).update({ ...data, updated_at: new Date() }).returning('*');

        // Record history for each changed field
        const trackFields = ['status', 'priority', 'assignee_id', 'sprint_id', 'estimated_date'] as const;
        for (const field of trackFields) {
            if (data[field as keyof typeof data] !== undefined && String(old[field]) !== String(data[field as keyof typeof data])) {
                await db('task_history').insert({
                    task_id: id,
                    changed_by: updatedBy,
                    field_name: field,
                    old_value: old[field],
                    new_value: data[field as keyof typeof data],
                });
            }
        }

        // Update sprint progress
        if (task.sprint_id) {
            const stats = await db('tasks').where('sprint_id', task.sprint_id)
                .select(db.raw('COUNT(*) as total'), db.raw(`SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done`)).first();
            const progress = (stats as any).total > 0 ? Math.round(((stats as any).done / (stats as any).total) * 100) : 0;
            await db('sprints').where('id', task.sprint_id).update({ progress });
        }

        // B5 fix: recalculate project progress after updating a task (especially status change)
        if (task.project_id) {
            await projectRepo.recalcProgress(task.project_id).catch(() => {/* non-critical */ });
        }

        return task;
    }

    async delete(id: string): Promise<void> {
        // Fetch project_id before delete for recalc
        const task = await db('tasks').where('id', id).select('project_id', 'sprint_id').first();
        await db('tasks').where({ id }).delete();
        if (task?.project_id) {
            await projectRepo.recalcProgress(task.project_id).catch(() => { });
        }
        if (task?.sprint_id) {
            const stats = await db('tasks').where('sprint_id', task.sprint_id)
                .select(db.raw('COUNT(*) as total'), db.raw(`SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done`)).first();
            const progress = (stats as any).total > 0 ? Math.round(((stats as any).done / (stats as any).total) * 100) : 0;
            await db('sprints').where('id', task.sprint_id).update({ progress }).catch(() => { });
        }
    }

    async addComment(taskId: string, authorId: string, body: string, isQa: boolean): Promise<object> {
        const [comment] = await db('task_comments').insert({ task_id: taskId, author_id: authorId, body, is_qa: isQa }).returning('*');
        if (isQa) {
            const task = await db('tasks').where('id', taskId).first();
            if (task?.assignee_id) {
                const assignee = await db('users').where('id', task.assignee_id).first();
                if (assignee) sendEmailSafe(() => emailSvc.sendQaComment(assignee.email, assignee.name, task.title, body));
            }
        }
        return comment;
    }

    async addAttachment(taskId: string, filename: string, url: string): Promise<object> {
        const [att] = await db('task_attachments').insert({ task_id: taskId, filename, url }).returning('*');
        return att;
    }
}
