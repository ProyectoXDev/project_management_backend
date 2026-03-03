import { Router } from 'express';
import { body } from 'express-validator';
import { NotificationController } from './notification.controller';
import { authenticate } from '@interfaces/http/middlewares/auth.middleware';
import { validate } from '@interfaces/http/middlewares/validate.middleware';

const router = Router();
const ctrl = new NotificationController();
router.use(authenticate);

router.get('/', ctrl.getAll.bind(ctrl));
router.patch('/read', [body('ids').isArray()], validate, ctrl.markRead.bind(ctrl));
router.patch('/read-all', ctrl.markAllRead.bind(ctrl));

export default router;
