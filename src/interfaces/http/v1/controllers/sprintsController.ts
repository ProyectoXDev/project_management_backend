import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../../../../infrastructure/database/connection';
import { AppError } from '../middlewares/errorHandler';
import { authenticate, authorize } from '../middlewares/auth';

export const sprintsRouter = Router();

async function recalcSprintProgress(sprintId: string) {
    const tasks = await db('tasks').where({ sprint_id: sprintId });
    if (!tasks.length) return;
    const done = tasks.filter((t: any) => t.status === 'done').length;
    const progress = Math.round((done / tasks.length) * 100);
    await db('sprints').where({ id: sprintId }).update({ progress });
}

/** GET /sprints?project_id= */
sprintsRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const q = db('sprints as s')
            .leftJoin('projects as p', 's.project_id', 'p.id')
            .select('s.*', 'p.name as project_name');
        if (req.query.project_id) q.where('s.project_id', req.query.project_id as string);
        const sprints = await q.orderBy('s.sprint_number', 'asc');
        res.json({ success: true, data: sprints });
    } catch (e) { next(e); }
});

/** GET /sprints/:id */
sprintsRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sprint = await db('sprints').where({ id: req.params.id }).first();
        if (!sprint) return next(new AppError('Sprint not found', 404));
        const tasks = await db('tasks as t')
            .leftJoin('users as u', 't.assignee_id', 'u.id')
            .select('t.*', 'u.name as assignee_name')
            .where('t.sprint_id', sprint.id);
        const migrations = await db('task_migrations').where({ from_sprint_id: sprint.id }).orWhere({ to_sprint_id: sprint.id });
        res.json({ success: true, data: { ...sprint, tasks, migrations } });
    } catch (e) { next(e); }
});

/** POST /sprints */
sprintsRouter.post('/', authenticate, authorize('admin', 'pm'),
    [body('name').notEmpty(), body('project_id').notEmpty()],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next(new AppError('Validation failed', 400));
        try {
            // auto-number sprint
            const count = await db('sprints').where({ project_id: req.body.project_id }).count('id as c').first();
            const sprintNumber = parseInt((count as any).c || '0') + 1;
            const [sprint] = await db('sprints').insert({ ...req.body, sprint_number: sprintNumber, progress: 0 }).returning('*');
            res.status(201).json({ success: true, data: sprint });
        } catch (e) { next(e); }
    }
);

/** PUT /sprints/:id */
sprintsRouter.put('/:id', authenticate, authorize('admin', 'pm'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const [updated] = await db('sprints').where({ id: req.params.id })
                .update({ ...req.body, updated_at: new Date() }).returning('*');
            if (!updated) return next(new AppError('Sprint not found', 404));
            res.json({ success: true, data: updated });
        } catch (e) { next(e); }
    }
);

/** DELETE /sprints/:id */
sprintsRouter.delete('/:id', authenticate, authorize('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await db('sprints').where({ id: req.params.id }).del();
            res.json({ success: true, message: 'Sprint deleted' });
        } catch (e) { next(e); }
    }
);

/** POST /sprints/:id/migrate-task — migrate task with mandatory reason */
sprintsRouter.post('/:id/migrate-task', authenticate, authorize('admin', 'pm'),
    [body('task_id').notEmpty(), body('to_sprint_id').notEmpty(), body('reason').notEmpty().withMessage('Reason is required for task migration')],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));
        try {
            const { task_id, to_sprint_id, reason } = req.body;
            const task = await db('tasks').where({ id: task_id }).first();
            if (!task) return next(new AppError('Task not found', 404));

            await db('task_migrations').insert({
                task_id, from_sprint_id: req.params.id, to_sprint_id, reason, migrated_by: req.user!.userId,
            });
            await db('tasks').where({ id: task_id }).update({ sprint_id: to_sprint_id });
            await recalcSprintProgress(req.params.id);
            await recalcSprintProgress(to_sprint_id);

            res.json({ success: true, message: 'Task migrated successfully' });
        } catch (e) { next(e); }
    }
);
