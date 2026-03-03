import { Router } from 'express';
import { body } from 'express-validator';
import { DocumentController } from './document.controller';
import { authenticate } from '@interfaces/http/middlewares/auth.middleware';
import { validate } from '@interfaces/http/middlewares/validate.middleware';

const router = Router();
const ctrl = new DocumentController();
router.use(authenticate);

router.get('/', ctrl.getAll.bind(ctrl));
router.get('/template/:type', ctrl.generateTemplate.bind(ctrl));
router.get('/:id', ctrl.getById.bind(ctrl));
router.post('/',
  [body('project_id').isUUID(), body('title').notEmpty(), body('category').isIn(['backend','frontend','database','design','environments','apis','hu','qa'])],
  validate, ctrl.create.bind(ctrl)
);
router.put('/:id', ctrl.update.bind(ctrl));
router.delete('/:id', ctrl.delete.bind(ctrl));
router.post('/render-markdown', [body('markdown').notEmpty()], validate, ctrl.renderMarkdown.bind(ctrl));

export default router;
