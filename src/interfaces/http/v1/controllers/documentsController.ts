import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { db } from '../../../../infrastructure/database/connection';
import { AppError } from '../middlewares/errorHandler';
import { authenticate } from '../middlewares/auth';

export const documentsRouter = Router();

const storage = multer.diskStorage({
    destination: 'uploads/documents/',
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// QA Template generator
function generateQATemplate(projectName = 'Project'): string {
    return `# QA Test Report — ${projectName}

## Test Summary
| Total | Passed | Failed | Blocked |
|-------|--------|--------|---------|
| 0     | 0      | 0      | 0       |

## Test Cases
### TC-001: [Test Case Name]
- **Preconditions:** 
- **Steps:** 
  1. Step 1
- **Expected Result:** 
- **Actual Result:** 
- **Status:** ⬜ Pending / ✅ Pass / ❌ Fail

## Bug Report
### BUG-001: [Bug Title]
- **Severity:** Critical / High / Medium / Low
- **Steps to Reproduce:** 
- **Evidence:** [screenshots/videos]
`;
}

// HU Template generator
function generateHUTemplate(): string {
    return `# Historia de Usuario

## HU-XXX: [Título de la Historia]

**Como** [tipo de usuario]  
**Quiero** [objetivo]  
**Para** [beneficio]

## Criterios de Aceptación
- [ ] CA-1: 
- [ ] CA-2: 

## Restricciones Técnicas
- 

## Definición de Listo (DoD)
- [ ] Código revisado
- [ ] Pruebas unitarias pasando
- [ ] QA validado
- [ ] Documentación actualizada

## Estimación
- **Story Points:** 
- **Sprint:** 
`;
}

// GET /documents?project_id=&category=
documentsRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const q = db('documents as d')
            .leftJoin('users as u', 'd.uploaded_by', 'u.id')
            .leftJoin('projects as p', 'd.project_id', 'p.id')
            .select('d.*', 'u.name as uploaded_by_name', 'p.name as project_name');
        if (req.query.project_id) q.where('d.project_id', req.query.project_id as string);
        if (req.query.category) q.where('d.category', req.query.category as string);
        const docs = await q.orderBy('d.created_at', 'desc');
        res.json({ success: true, data: docs });
    } catch (e) { next(e); }
});

// GET /documents/:id
documentsRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const doc = await db('documents').where({ id: req.params.id }).first();
        if (!doc) return next(new AppError('Document not found', 404));
        res.json({ success: true, data: doc });
    } catch (e) { next(e); }
});

// POST /documents — create with Markdown content
documentsRouter.post('/', authenticate,
    [body('title').notEmpty(), body('category').notEmpty()],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next(new AppError('Validation failed', 400));
        try {
            const [doc] = await db('documents').insert({ ...req.body, uploaded_by: req.user!.userId, version: 1 }).returning('*');
            res.status(201).json({ success: true, data: doc });
        } catch (e) { next(e); }
    }
);

// PUT /documents/:id
documentsRouter.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await db('documents').where({ id: req.params.id }).first();
        if (!existing) return next(new AppError('Document not found', 404));
        const [updated] = await db('documents').where({ id: req.params.id })
            .update({ ...req.body, version: existing.version + 1, updated_at: new Date() }).returning('*');
        res.json({ success: true, data: updated });
    } catch (e) { next(e); }
});

// DELETE /documents/:id
documentsRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        await db('documents').where({ id: req.params.id }).del();
        res.json({ success: true, message: 'Document deleted' });
    } catch (e) { next(e); }
});

// POST /documents/upload — upload file, store reference
documentsRouter.post('/upload', authenticate, upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) return next(new AppError('No file uploaded', 400));
        try {
            const [doc] = await db('documents').insert({
                title: req.body.title || req.file.originalname,
                category: req.body.category || 'other',
                project_id: req.body.project_id || null,
                file_url: `/uploads/documents/${req.file.filename}`,
                mime_type: req.file.mimetype,
                uploaded_by: req.user!.userId,
                version: 1,
            }).returning('*');
            res.status(201).json({ success: true, data: doc });
        } catch (e) { next(e); }
    }
);

// GET /documents/templates/qa
documentsRouter.get('/templates/qa', authenticate, (req: Request, res: Response) => {
    res.json({ success: true, data: { template: generateQATemplate(req.query.project as string) } });
});

// GET /documents/templates/hu
documentsRouter.get('/templates/hu', authenticate, (_req: Request, res: Response) => {
    res.json({ success: true, data: { template: generateHUTemplate() } });
});
