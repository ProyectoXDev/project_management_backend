import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserRepository } from '@infrastructure/repositories/user.repository';

const repo = new UserRepository();

export class TeamController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const data = await repo.findAll(req.query as any);
      res.json({ success: true, data });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const user = await repo.findById(req.params.id);
      if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
      const { password_hash: _, ...safe } = user;
      res.json({ success: true, data: safe });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { password, ...rest } = req.body;
      const password_hash = await bcrypt.hash(password, 12);
      const user = await repo.create({ ...rest, password_hash });
      const { password_hash: _, ...safe } = user;
      res.status(201).json({ success: true, data: safe });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { password, ...rest } = req.body;
      const updateData: any = { ...rest };
      if (password) updateData.password_hash = await bcrypt.hash(password, 12);
      const user = await repo.update(req.params.id, updateData);
      const { password_hash: _, ...safe } = user;
      res.json({ success: true, data: safe });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      await repo.delete(req.params.id);
      res.json({ success: true, message: 'User deleted' });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }
}
