import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ScrumEventController } from './scrumEvent.controller';
import { authenticate } from '@interfaces/http/middlewares/auth.middleware';
import { validate } from '@interfaces/http/middlewares/validate.middleware';
import config from '@config/index';

const storage = multer.diskStorage({
  destination: config.storage.uploadDir,
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();
const ctrl = new ScrumEventController();
router.use(authenticate);

router.get('/', ctrl.getAll.bind(ctrl));
router.get('/:id', ctrl.getById.bind(ctrl));
router.post('/',
  [body('project_id').isUUID(), body('title').notEmpty(), body('type').isIn(['planning','review','retro','daily']), body('event_date').isDate()],
  validate, ctrl.create.bind(ctrl)
);
router.put('/:id', ctrl.update.bind(ctrl));
router.delete('/:id', ctrl.delete.bind(ctrl));
router.post('/:id/files', upload.single('file'), ctrl.uploadFile.bind(ctrl));

export default router;
