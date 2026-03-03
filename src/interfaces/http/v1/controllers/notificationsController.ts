import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../../../infrastructure/database/connection';
import { authenticate } from '../middlewares/auth';

export const notificationsRouter = Router();

notificationsRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const notifications = await db('notifications')
            .where({ user_id: req.user!.userId })
            .orderBy('created_at', 'desc')
            .limit(50);
        res.json({ success: true, data: notifications });
    } catch (e) { next(e); }
});

notificationsRouter.patch('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        await db('notifications').where({ id: req.params.id, user_id: req.user!.userId }).update({ read: true });
        res.json({ success: true, message: 'Marked as read' });
    } catch (e) { next(e); }
});

notificationsRouter.patch('/read-all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        await db('notifications').where({ user_id: req.user!.userId, read: false }).update({ read: true });
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (e) { next(e); }
});
