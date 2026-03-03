import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../../../../infrastructure/database/connection';
import { AppError } from '../middlewares/errorHandler';
import { authenticate, authorize } from '../middlewares/auth';

export const projectsRouter = Router();

// Helper: recalculate project progress based on tasks
async function recalcProjectProgress(projectId: string) {
    const tasks = await db('tasks').where({ project_id: projectId });
    if (!tasks.length) return;
    const done = tasks.filter((t: any) => t.status === 'done').length;
    const progress = Math.round((done / tasks.length) * 100);
    // Priority score: inverse of days until deadline * pending tasks weight
    const project = await db('projects').where({ id: projectId }).first();
    let priorityScore = 50;
    if (project.end_date) {
        const daysLeft = Math.max(0, (new Date(project.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const pending = tasks.filter((t: any) => t.status !== 'done').length;
        priorityScore = Math.min(100, Math.round((pending / Math.max(1, daysLeft)) * 100));
    }
    await db('projects').where({ id: projectId }).update({ progress, priority_score: priorityScore });
}

/** GET /projects */
projectsRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const projects = await db('projects as p')
            .leftJoin('users as pm', 'p.pm_id', 'pm.id')
            .select('p.*', 'pm.name as pm_name', 'pm.email as pm_email')
            .where('p.is_active', true)
            .orderBy('p.priority_score', 'desc');
        res.json({ success: true, data: projects });
    } catch (e) { next(e); }
});

/** GET /projects/:id */
projectsRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await db('projects as p')
            .leftJoin('users as pm', 'p.pm_id', 'pm.id')
            .select('p.*', 'pm.name as pm_name')
            .where('p.id', req.params.id).first();
        if (!project) return next(new AppError('Project not found', 404));

        const members = await db('project_members as pm')
            .join('users as u', 'pm.user_id', 'u.id')
            .select('u.id', 'u.name', 'u.email', 'u.role', 'pm.capacity_pct', 'pm.responsibilities')
            .where('pm.project_id', project.id);

        const sprints = await db('sprints').where({ project_id: project.id }).orderBy('sprint_number');
        res.json({ success: true, data: { ...project, members, sprints } });
    } catch (e) { next(e); }
});

/** POST /projects */
projectsRouter.post('/', authenticate, authorize('admin', 'pm'),
    [body('name').notEmpty().trim()],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next(new AppError('Validation failed', 400));
        try {
            const [project] = await db('projects').insert({
                ...req.body,
                progress: 0,
                priority_score: 0,
            }).returning('*');
            res.status(201).json({ success: true, data: project });
        } catch (e) { next(e); }
    }
);

/** PUT /projects/:id */
projectsRouter.put('/:id', authenticate, authorize('admin', 'pm'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const [updated] = await db('projects').where({ id: req.params.id })
                .update({ ...req.body, updated_at: new Date() }).returning('*');
            if (!updated) return next(new AppError('Project not found', 404));
            await recalcProjectProgress(req.params.id);
            res.json({ success: true, data: updated });
        } catch (e) { next(e); }
    }
);

/** DELETE /projects/:id (soft delete) */
projectsRouter.delete('/:id', authenticate, authorize('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await db('projects').where({ id: req.params.id }).update({ is_active: false });
            res.json({ success: true, message: 'Project archived' });
        } catch (e) { next(e); }
    }
);

/** POST /projects/:id/members */
projectsRouter.post('/:id/members', authenticate, authorize('admin', 'pm'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { user_id, capacity_pct, responsibilities } = req.body;
            const existing = await db('project_members').where({ project_id: req.params.id, user_id }).first();
            if (existing) return next(new AppError('User already in project', 409));
            const [member] = await db('project_members').insert({
                project_id: req.params.id, user_id, capacity_pct: capacity_pct || 100, responsibilities,
            }).returning('*');
            res.status(201).json({ success: true, data: member });
        } catch (e) { next(e); }
    }
);

/** DELETE /projects/:id/members/:userId */
projectsRouter.delete('/:id/members/:userId', authenticate, authorize('admin', 'pm'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await db('project_members').where({ project_id: req.params.id, user_id: req.params.userId }).del();
            res.json({ success: true, message: 'Member removed' });
        } catch (e) { next(e); }
    }
);
