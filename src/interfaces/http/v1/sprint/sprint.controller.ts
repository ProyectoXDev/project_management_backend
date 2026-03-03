import { Request, Response } from 'express';
import { SprintRepository } from '@infrastructure/repositories/sprint.repository';

const repo = new SprintRepository();

export class SprintController {
  async getByProject(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.findByProject(req.params.projectId);
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.findById(req.params.id);
      if (!data) { res.status(404).json({ success: false, message: 'Sprint not found' }); return; }
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.update(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      await repo.delete(req.params.id);
      res.json({ success: true, message: 'Deleted' });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async migrateTask(req: Request, res: Response): Promise<void> {
    try {
      await repo.migrateTask({ ...req.body, migratedBy: req.user!.userId });
      res.json({ success: true, message: 'Task migrated' });
    } catch (e: any) { res.status(400).json({ success: false, message: e.message }); }
  }
}
