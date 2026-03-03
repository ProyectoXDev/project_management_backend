import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from './auth.controller';
import { authenticate } from '@interfaces/http/middlewares/auth.middleware';
import { validate } from '@interfaces/http/middlewares/validate.middleware';

const router = Router();
const ctrl = new AuthController();

router.post('/login',
    [body('email').isEmail(), body('password').notEmpty()],
    validate,
    ctrl.login.bind(ctrl)
);

router.post('/refresh',
    [body('refreshToken').notEmpty()],
    validate,
    ctrl.refresh.bind(ctrl)
);

router.post('/logout',
    [body('refreshToken').notEmpty()],
    validate,
    ctrl.logout.bind(ctrl)
);

router.get('/me', authenticate, ctrl.me.bind(ctrl));

export default router;
