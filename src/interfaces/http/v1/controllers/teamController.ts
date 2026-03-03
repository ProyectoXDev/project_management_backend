import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { db } from '../../../../infrastructure/database/connection';
import { AppError } from '../middlewares/errorHandler';
import { authenticate, authorize } from '../middlewares/auth';

export const teamRouter = Router();

// GET /team
teamRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await db('users as u')
            .select('u.id', 'u.name', 'u.email', 'u.role', 'u.status', 'u.avatar_url', 'u.created_at')
            .orderBy('u.name');
        // Get project assignments per user
        const result = await Promise.all(users.map(async (user: any) => {
            const projects = await db('project_members as pm')
                .join('projects as p', 'pm.project_id', 'p.id')
                .select('p.id', 'p.name', 'pm.capacity_pct', 'pm.responsibilities')
                .where('pm.user_id', user.id).andWhere('p.is_active', true);
            return { ...user, projects };
        }));
        res.json({ success: true, data: result });
    } catch (e) { next(e); }
});

// GET /team/:id
teamRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await db('users').where({ id: req.params.id })
            .select('id', 'name', 'email', 'role', 'status', 'avatar_url', 'created_at').first();
        if (!user) return next(new AppError('User not found', 404));
        const projects = await db('project_members as pm')
            .join('projects as p', 'pm.project_id', 'p.id')
            .select('p.id', 'p.name', 'pm.capacity_pct', 'pm.responsibilities')
            .where('pm.user_id', user.id);
        const tasks = await db('tasks').where({ assignee_id: user.id, status: 'in_progress' }).count('id as count').first();
        res.json({ success: true, data: { ...user, projects, active_tasks: (tasks as any).count } });
    } catch (e) { next(e); }
});

// POST /team (admin only)
teamRouter.post('/', authenticate, authorize('admin'),
    [body('name').notEmpty(), body('email').isEmail(), body('password').isLength({ min: 8 }), body('role').isIn(['admin', 'pm', 'dev', 'qa'])],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next(new AppError('Validation failed', 400));
        try {
            const existing = await db('users').where({ email: req.body.email }).first();
            if (existing) return next(new AppError('Email already registered', 409));
            const hash = await bcrypt.hash(req.body.password, 10);
            const [user] = await db('users').insert({ ...req.body, password_hash: hash, password: undefined }).returning('id name email role status');
            res.status(201).json({ success: true, data: user });
        } catch (e) { next(e); }
    }
);

// PUT /team/:id
teamRouter.put('/:id', authenticate, authorize('admin', 'pm'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const updates: any = { ...req.body, updated_at: new Date() };
            if (updates.password) {
                updates.password_hash = await bcrypt.hash(updates.password, 10);
                delete updates.password;
            }
            delete updates.email; // email cannot be changed via this endpoint
            const [updated] = await db('users').where({ id: req.params.id }).update(updates).returning('id name email role status');
            if (!updated) return next(new AppError('User not found', 404));
            res.json({ success: true, data: updated });
        } catch (e) { next(e); }
    }
);

// PATCH /team/:id/status
teamRouter.patch('/:id/status', authenticate, authorize('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { status } = req.body;
            if (!['active', 'inactive'].includes(status)) return next(new AppError('Invalid status', 400));
            await db('users').where({ id: req.params.id }).update({ status });
            res.json({ success: true, message: `User set to ${status}` });
        } catch (e) { next(e); }
    }
);
