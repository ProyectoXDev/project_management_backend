import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import { db } from '../../../../infrastructure/database/connection';
import { AppError } from '../middlewares/errorHandler';
import { authenticate } from '../middlewares/auth';

export const tasksRouter = Router();

const storage = multer.diskStorage({
    destination: 'uploads/tasks/',
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

async function addTaskHistory(taskId: string, userId: string, field: string, oldVal: any, newVal: any) {
    await db('task_history').insert({ task_id: taskId, changed_by: userId, field_name: field, old_value: String(oldVal ?? ''), new_value: String(newVal ?? '') });
}

async function recalcSprint(sprintId: string) {
    if (!sprintId) return;
    const tasks = await db('tasks').where({ sprint_id: sprintId });
    if (!tasks.length) return;
    const done = tasks.filter((t: any) => t.status === 'done').length;
    await db('sprints').where({ id: sprintId }).update({ progress: Math.round((done / tasks.length) * 100) });
}

// GET /tasks?project_id=&sprint_id=&status=&assignee_id=
tasksRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const q = db('tasks as t')
            .leftJoin('users as u', 't.assignee_id', 'u.id')
            .leftJoin('sprints as s', 't.sprint_id', 's.id')
            .leftJoin('projects as p', 't.project_id', 'p.id')
            .select('t.*', 'u.name as assignee_name', 'u.email as assignee_email', 's.name as sprint_name', 'p.name as project_name');
        if (req.query.project_id) q.where('t.project_id', req.query.project_id as string);
        if (req.query.sprint_id) q.where('t.sprint_id', req.query.sprint_id as string);
        if (req.query.status) q.where('t.status', req.query.status as string);
        if (req.query.assignee_id) q.where('t.assignee_id', req.query.assignee_id as string);
        if (req.query.priority) q.where('t.priority', req.query.priority as string);
        const tasks = await q.orderBy('t.created_at', 'desc');
        res.json({ success: true, data: tasks });
    } catch (e) { next(e); }
});

// GET /tasks/:id — full task with history, comments, attachments
tasksRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const task = await db('tasks as t')
            .leftJoin('users as u', 't.assignee_id', 'u.id')
            .select('t.*', 'u.name as assignee_name')
            .where('t.id', req.params.id).first();
        if (!task) return next(new AppError('Task not found', 404));
        const history = await db('task_history as h').leftJoin('users as u', 'h.changed_by', 'u.id')
            .select('h.*', 'u.name as changed_by_name').where('h.task_id', task.id).orderBy('h.changed_at', 'desc');
        const comments = await db('task_comments as c').leftJoin('users as u', 'c.author_id', 'u.id')
            .select('c.*', 'u.name as author_name').where('c.task_id', task.id).orderBy('c.created_at', 'asc');
        const attachments = await db('task_attachments').where({ task_id: task.id });
        res.json({ success: true, data: { ...task, history, comments, attachments } });
    } catch (e) { next(e); }
});

// POST /tasks
tasksRouter.post('/', authenticate,
    [body('title').notEmpty(), body('project_id').notEmpty()],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next(new AppError('Validation failed', 400));
        try {
            const [task] = await db('tasks').insert({ ...req.body, creator_id: req.user!.userId }).returning('*');
            if (task.sprint_id) await recalcSprint(task.sprint_id);
            res.status(201).json({ success: true, data: task });
        } catch (e) { next(e); }
    }
);

// PUT /tasks/:id
tasksRouter.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const old = await db('tasks').where({ id: req.params.id }).first();
        if (!old) return next(new AppError('Task not found', 404));
        const [updated] = await db('tasks').where({ id: req.params.id }).update({ ...req.body, updated_at: new Date() }).returning('*');
        // Track history for key fields
        const trackFields = ['status', 'priority', 'assignee_id', 'sprint_id', 'estimated_date'];
        for (const f of trackFields) {
            if (req.body[f] !== undefined && String(req.body[f]) !== String(old[f])) {
                await addTaskHistory(old.id, req.user!.userId, f, old[f], req.body[f]);
            }
        }
        if (updated.sprint_id) await recalcSprint(updated.sprint_id);
        if (old.sprint_id && old.sprint_id !== updated.sprint_id) await recalcSprint(old.sprint_id);
        res.json({ success: true, data: updated });
    } catch (e) { next(e); }
});

// DELETE /tasks/:id
tasksRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const task = await db('tasks').where({ id: req.params.id }).first();
        if (!task) return next(new AppError('Task not found', 404));
        await db('tasks').where({ id: req.params.id }).del();
        if (task.sprint_id) await recalcSprint(task.sprint_id);
        res.json({ success: true, message: 'Task deleted' });
    } catch (e) { next(e); }
});

// POST /tasks/:id/comments
tasksRouter.post('/:id/comments',
    [body('body').notEmpty()],
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const [comment] = await db('task_comments').insert({
                task_id: req.params.id, author_id: req.user!.userId, body: req.body.body, is_qa: req.body.is_qa || false,
            }).returning('*');
            res.status(201).json({ success: true, data: comment });
        } catch (e) { next(e); }
    }
);

// POST /tasks/:id/attachments
tasksRouter.post('/:id/attachments', authenticate, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) return next(new AppError('No file uploaded', 400));
    try {
        const [att] = await db('task_attachments').insert({
            task_id: req.params.id,
            filename: req.file.originalname,
            url: `/uploads/tasks/${req.file.filename}`,
            mime_type: req.file.mimetype,
            size_bytes: req.file.size,
        }).returning('*');
        res.status(201).json({ success: true, data: att });
    } catch (e) { next(e); }
});
