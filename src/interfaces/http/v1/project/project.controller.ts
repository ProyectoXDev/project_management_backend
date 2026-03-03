import { Request, Response } from 'express';
import { ProjectRepository } from '@infrastructure/repositories/project.repository';

const repo = new ProjectRepository();

export class ProjectController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.findAll(req.query as any);
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.findById(req.params.id);
      if (!data) { res.status(404).json({ success: false, message: 'Proyecto no encontrado' }); return; }
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
      await repo.recalcProgress(req.params.id);
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  // Punto 4: eliminación segura — retorna action: 'deactivated' | 'deleted'
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const result = await repo.safeDelete(req.params.id);
      res.json({ success: true, ...result });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  // Reactiva un proyecto inactivo
  async reactivate(req: Request, res: Response): Promise<void> {
    try {
      await repo.reactivate(req.params.id);
      res.json({ success: true, message: 'Proyecto reactivado' });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }
}
