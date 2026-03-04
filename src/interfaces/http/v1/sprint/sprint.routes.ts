import { Router } from 'express';
import { body } from 'express-validator';
import { SprintController } from './sprint.controller';
import { authenticate } from '@interfaces/http/middlewares/auth.middleware';
import { authorize } from '@interfaces/http/middlewares/roles.middleware';
import { validate } from '@interfaces/http/middlewares/validate.middleware';
import { auditLog } from '@interfaces/http/middlewares/audit.middleware';

const router = Router();
const ctrl = new SprintController();
router.use(authenticate);

router.get('/', ctrl.getAll.bind(ctrl));
router.get('/project/:projectId', ctrl.getByProject.bind(ctrl));
router.get('/:id', ctrl.getById.bind(ctrl));
router.post('/',
  authorize('admin', 'pm'),
  [body('project_id').isUUID(), body('name').notEmpty(), body('start_date').isDate(), body('end_date').isDate()],
  validate, auditLog('CREATE', 'sprint'), ctrl.create.bind(ctrl)
);
router.put('/:id', authorize('admin', 'pm'), auditLog('UPDATE', 'sprint'), ctrl.update.bind(ctrl));
router.delete('/:id', authorize('admin', 'pm'), auditLog('DELETE', 'sprint'), ctrl.delete.bind(ctrl));
router.post('/migrate',
  authorize('admin', 'pm'),
  [body('taskId').isUUID(), body('fromSprintId').isUUID(), body('toSprintId').isUUID(), body('reason').notEmpty()],
  validate, auditLog('MIGRATE_TASK', 'sprint'), ctrl.migrateTask.bind(ctrl)
);

export default router;
