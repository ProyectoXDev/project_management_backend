import { Request, Response } from 'express';
import { SprintRepository } from '@infrastructure/repositories/sprint.repository';

const repo = new SprintRepository();

export class SprintController {

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, status } = req.query as { projectId?: string; status?: string };
      const data = await repo.findAll({ projectId, status });
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async getByProject(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.findByProject(req.params.projectId);
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.findById(req.params.id);
      if (!data) { res.status(404).json({ success: false, message: 'Sprint no encontrado' }); return; }
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  /** Smart create: cierra sprint activo y migra tareas pendientes si ya existe uno. */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const migratedBy = req.user?.userId;
      const { sprint, closedSprint } = await repo.create(req.body, migratedBy);
      res.status(201).json({
        success: true,
        data: sprint,
        warning: closedSprint
          ? `El sprint "${closedSprint.name}" fue cerrado y sus tareas pendientes fueron heredadas al nuevo sprint.`
          : null,
      });
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
      res.json({ success: true, message: 'Sprint eliminado' });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async migrateTask(req: Request, res: Response): Promise<void> {
    try {
      await repo.migrateTask({ ...req.body, migratedBy: req.user!.userId });
      res.json({ success: true, message: 'Tarea migrada correctamente' });
    } catch (e: any) { res.status(400).json({ success: false, message: e.message }); }
  }
}
