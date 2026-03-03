import { Request, Response } from 'express';
import db from '@config/database';

export class NotificationController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const data = await db('notifications')
        .where('user_id', req.user!.userId)
        .orderBy('created_at', 'desc')
        .limit(50);
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async markRead(req: Request, res: Response): Promise<void> {
    try {
      const { ids } = req.body;
      await db('notifications')
        .where('user_id', req.user!.userId)
        .whereIn('id', ids)
        .update({ read: true });
      res.json({ success: true, message: 'Marked as read' });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async markAllRead(req: Request, res: Response): Promise<void> {
    try {
      await db('notifications').where('user_id', req.user!.userId).update({ read: true });
      res.json({ success: true, message: 'All marked as read' });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }
}
