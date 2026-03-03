import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { db } from '../../../../infrastructure/database/connection';
import { AppError } from '../middlewares/errorHandler';
import { authenticate, authorize } from '../middlewares/auth';

export const scrumEventsRouter = Router();

const storage = multer.diskStorage({
    destination: 'uploads/scrum-events/',
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// GET /scrum-events?project_id=&type=
scrumEventsRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const q = db('scrum_events as se')
            .leftJoin('users as u', 'se.created_by', 'u.id')
            .leftJoin('projects as p', 'se.project_id', 'p.id')
            .select('se.*', 'u.name as created_by_name', 'p.name as project_name');
        if (req.query.project_id) q.where('se.project_id', req.query.project_id as string);
        if (req.query.type) q.where('se.type', req.query.type as string);
        const events = await q.orderBy('se.event_date', 'desc');
        res.json({ success: true, data: events });
    } catch (e) { next(e); }
});

// GET /scrum-events/:id
scrumEventsRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const event = await db('scrum_events as se')
            .leftJoin('users as u', 'se.created_by', 'u.id')
            .select('se.*', 'u.name as created_by_name')
            .where('se.id', req.params.id).first();
        if (!event) return next(new AppError('Event not found', 404));
        const files = await db('scrum_event_files').where({ event_id: event.id });
        res.json({ success: true, data: { ...event, files } });
    } catch (e) { next(e); }
});

// POST /scrum-events
scrumEventsRouter.post('/', authenticate, authorize('admin', 'pm'),
    [body('title').notEmpty(), body('project_id').notEmpty(), body('event_date').notEmpty()],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next(new AppError('Validation failed', 400));
        try {
            const [event] = await db('scrum_events').insert({ ...req.body, created_by: req.user!.userId, version: 1 }).returning('*');
            res.status(201).json({ success: true, data: event });
        } catch (e) { next(e); }
    }
);

// PUT /scrum-events/:id — versioned update
scrumEventsRouter.put('/:id', authenticate, authorize('admin', 'pm'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const existing = await db('scrum_events').where({ id: req.params.id }).first();
            if (!existing) return next(new AppError('Event not found', 404));
            const [updated] = await db('scrum_events').where({ id: req.params.id })
                .update({ ...req.body, version: existing.version + 1, updated_at: new Date() }).returning('*');
            res.json({ success: true, data: updated });
        } catch (e) { next(e); }
    }
);

// DELETE /scrum-events/:id
scrumEventsRouter.delete('/:id', authenticate, authorize('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await db('scrum_events').where({ id: req.params.id }).del();
            res.json({ success: true, message: 'Event deleted' });
        } catch (e) { next(e); }
    }
);

// POST /scrum-events/:id/files
scrumEventsRouter.post('/:id/files', authenticate, upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) return next(new AppError('No file uploaded', 400));
        try {
            const [file] = await db('scrum_event_files').insert({
                event_id: req.params.id,
                filename: req.file.originalname,
                url: `/uploads/scrum-events/${req.file.filename}`,
            }).returning('*');
            res.status(201).json({ success: true, data: file });
        } catch (e) { next(e); }
    }
);
