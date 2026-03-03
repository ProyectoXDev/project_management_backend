import { Request, Response } from 'express';
import path from 'path';
import { TaskRepository } from '@infrastructure/repositories/task.repository';
import config from '@config/index';

const repo = new TaskRepository();

export class TaskController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.findAll(req.query as any);
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.findById(req.params.id);
      if (!data) { res.status(404).json({ success: false, message: 'Task not found' }); return; }
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.create(req.body, req.user!.userId);
      res.status(201).json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.update(req.params.id, req.body, req.user!.userId);
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      await repo.delete(req.params.id);
      res.json({ success: true, message: 'Deleted' });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async addComment(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.addComment(req.params.id, req.user!.userId, req.body.body, req.body.is_qa || false);
      res.status(201).json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async uploadAttachment(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return; }
      const url = `/uploads/${req.file.filename}`;
      const data = await repo.addAttachment(req.params.id, req.file.originalname, url);
      res.status(201).json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }
}
