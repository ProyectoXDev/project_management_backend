import { Request, Response } from 'express';
import { marked } from 'marked';
import db from '@config/database';

const QA_TEMPLATE = `# QA Test Plan\n\n## Test Case: [Title]\n\n| # | Step | Expected | Result | Status |\n|---|------|----------|--------|--------|\n| 1 |  |  |  | ⬜ Pass / ❌ Fail |\n\n## Environment\n- OS:\n- Browser:\n- Version:\n`;
const HU_TEMPLATE = `# User Story\n\n**As a** [role]\n**I want** [feature]\n**So that** [benefit]\n\n## Acceptance Criteria\n- [ ] \n- [ ] \n\n## Definition of Done\n- [ ] Code reviewed\n- [ ] Tests passing\n- [ ] Deployed to staging\n`;

export class DocumentController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      let q = db('documents').leftJoin('users','documents.uploaded_by','users.id')
        .select('documents.*','users.name as author_name');
      if (req.query.projectId) q = q.where('documents.project_id', req.query.projectId as string);
      if (req.query.category) q = q.where('documents.category', req.query.category as string);
      res.json({ success: true, data: await q.orderBy('documents.created_at','desc') });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const doc = await db('documents').where('id', req.params.id).first();
      if (!doc) { res.status(404).json({ success: false, message: 'Document not found' }); return; }
      res.json({ success: true, data: doc });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const [doc] = await db('documents').insert({ ...req.body, uploaded_by: req.user!.userId, version: 1 }).returning('*');
      res.status(201).json({ success: true, data: doc });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const [doc] = await db('documents').where('id', req.params.id)
        .update({ ...req.body, updated_at: new Date() }).returning('*');
      // bump version
      await db('documents').where('id', req.params.id).increment('version', 1);
      res.json({ success: true, data: doc });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      await db('documents').where('id', req.params.id).delete();
      res.json({ success: true, message: 'Deleted' });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }

  async generateTemplate(req: Request, res: Response): Promise<void> {
    const { type } = req.params;
    const content = type === 'qa' ? QA_TEMPLATE : type === 'hu' ? HU_TEMPLATE : null;
    if (!content) { res.status(400).json({ success: false, message: 'Unknown template type' }); return; }
    res.json({ success: true, data: { type, content_md: content } });
  }

  async renderMarkdown(req: Request, res: Response): Promise<void> {
    try {
      const { markdown } = req.body;
      const html = await marked(markdown || '');
      res.json({ success: true, data: { html } });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  }
}
