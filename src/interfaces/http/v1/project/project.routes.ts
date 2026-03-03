import { Router } from 'express';
import { body } from 'express-validator';
import { ProjectController } from './project.controller';
import { authenticate } from '@interfaces/http/middlewares/auth.middleware';
import { authorize } from '@interfaces/http/middlewares/roles.middleware';
import { validate } from '@interfaces/http/middlewares/validate.middleware';
import { auditLog } from '@interfaces/http/middlewares/audit.middleware';

const router = Router();
const ctrl = new ProjectController();
router.use(authenticate);

router.get('/', ctrl.getAll.bind(ctrl));
router.get('/:id', ctrl.getById.bind(ctrl));
router.post('/',
  authorize('admin', 'pm'),
  [body('name').notEmpty(), body('start_date').isDate(), body('type').isIn(['closed', 'open'])],
  validate, auditLog('CREATE', 'project'),
  ctrl.create.bind(ctrl)
);
router.put('/:id', authorize('admin', 'pm'), auditLog('UPDATE', 'project'), ctrl.update.bind(ctrl));
router.patch('/:id/reactivate', authorize('admin', 'pm'), auditLog('UPDATE', 'project'), ctrl.reactivate.bind(ctrl));
router.delete('/:id', authorize('admin'), auditLog('DELETE', 'project'), ctrl.delete.bind(ctrl));

export default router;
