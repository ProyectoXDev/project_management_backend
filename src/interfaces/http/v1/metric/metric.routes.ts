import { Router } from 'express';
import { MetricController } from './metric.controller';
import { authenticate } from '@interfaces/http/middlewares/auth.middleware';

const router = Router();
const ctrl = new MetricController();
router.use(authenticate);

router.get('/dashboard', ctrl.getDashboard.bind(ctrl));

export default router;
