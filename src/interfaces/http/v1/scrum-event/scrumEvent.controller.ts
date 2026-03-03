import { Request, Response } from 'express';
import db from '@config/database';

export class ScrumEventController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      let q = db('scrum_events').leftJoin('users','scrum_events.created_by','users.id')
        .select('scrum_events.*','users.name as author_name');
      if (req.query.projectId) q = q.where('scrum_events.project_id', req.query.projectId as string);
      if (req.query.type) q = q.where('scrum_events.type', req.query.type as string);
      res.json({ success: true, data: await q.orderBy('event_date','desc') });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const event = await db('scrum_events').where('scrum_events.id', req.params.id)
        .leftJoin('users','scrum_events.created_by','users.id')
        .select('scrum_events.*','users.name as author_name').first();
      if (!event) { res.status(404).json({ success: false, message: 'Event not found' }); return; }
      event.files = await db('scrum_event_files').where('event_id', req.params.id);
      res.json({ success: true, data: event });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const [event] = await db('scrum_events').insert({ ...req.body, created_by: req.user!.userId }).returning('*');
      res.status(201).json({ success: true, data: event });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const [event] = await db('scrum_events').where('id', req.params.id)
        .update({ ...req.body, updated_at: new Date() }).returning('*');
      res.json({ success: true, data: event });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      await db('scrum_events').where('id', req.params.id).delete();
      res.json({ success: true, message: 'Deleted' });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) { res.status(400).json({ success: false, message: 'No file' }); return; }
      const [f] = await db('scrum_event_files').insert({ event_id: req.params.id, filename: req.file.originalname, url: `/uploads/${req.file.filename}` }).returning('*');
      res.status(201).json({ success: true, data: f });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }
}
