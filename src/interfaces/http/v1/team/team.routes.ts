import { Router } from 'express';
import { body } from 'express-validator';
import { TeamController } from './team.controller';
import { authenticate } from '@interfaces/http/middlewares/auth.middleware';
import { authorize } from '@interfaces/http/middlewares/roles.middleware';
import { validate } from '@interfaces/http/middlewares/validate.middleware';
import { auditLog } from '@interfaces/http/middlewares/audit.middleware';

const router = Router();
const ctrl = new TeamController();
router.use(authenticate);

router.get('/', ctrl.getAll.bind(ctrl));
router.get('/:id', ctrl.getById.bind(ctrl));
router.post('/', authorize('admin'),
  [body('name').notEmpty(), body('email').isEmail(), body('password').isLength({min:8}), body('role').isIn(['admin','pm','dev','qa'])],
  validate, auditLog('CREATE','user'), ctrl.create.bind(ctrl)
);
router.put('/:id', authorize('admin'), auditLog('UPDATE','user'), ctrl.update.bind(ctrl));
router.delete('/:id', authorize('admin'), auditLog('DELETE','user'), ctrl.delete.bind(ctrl));

export default router;
