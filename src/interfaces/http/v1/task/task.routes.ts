import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TaskController } from './task.controller';
import { authenticate } from '@interfaces/http/middlewares/auth.middleware';
import { validate } from '@interfaces/http/middlewares/validate.middleware';
import { auditLog } from '@interfaces/http/middlewares/audit.middleware';
import config from '@config/index';

const storage = multer.diskStorage({
  destination: config.storage.uploadDir,
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();
const ctrl = new TaskController();
router.use(authenticate);

router.get('/', ctrl.getAll.bind(ctrl));
router.get('/:id', ctrl.getById.bind(ctrl));
router.post('/',
  [body('title').notEmpty(), body('project_id').isUUID(), body('priority').isIn(['low','medium','high','critical'])],
  validate, auditLog('CREATE','task'), ctrl.create.bind(ctrl)
);
router.put('/:id', auditLog('UPDATE','task'), ctrl.update.bind(ctrl));
router.delete('/:id', auditLog('DELETE','task'), ctrl.delete.bind(ctrl));
router.post('/:id/comments', [body('body').notEmpty()], validate, ctrl.addComment.bind(ctrl));
router.post('/:id/attachments', upload.single('file'), ctrl.uploadAttachment.bind(ctrl));

export default router;
