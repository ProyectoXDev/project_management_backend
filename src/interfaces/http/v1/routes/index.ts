import { Router, Request, Response } from 'express';
import { db } from '../../../../infrastructure/database/connection';
import { redisClient } from '../../../../config/redis';
import { authRouter } from './controllers/authController';
import { projectsRouter } from './controllers/projectsController';
import { sprintsRouter } from './controllers/sprintsController';
import { tasksRouter } from './controllers/tasksController';
import { teamRouter } from './controllers/teamController';
import { scrumEventsRouter } from './controllers/scrumEventsController';
import { documentsRouter } from './controllers/documentsController';
import { metricsRouter } from './controllers/metricsController';
import { notificationsRouter } from './controllers/notificationsController';

export const router = Router();

// Health check
router.get('/health', async (_req: Request, res: Response) => {
    let dbOk = false;
    let redisOk = false;
    try { await db.raw('SELECT 1'); dbOk = true; } catch { }
    try { await redisClient.ping(); redisOk = true; } catch { }
    const status = dbOk && redisOk ? 200 : 503;
    res.status(status).json({
        success: dbOk && redisOk,
        service: 'gravity-api',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        checks: { database: dbOk ? 'ok' : 'fail', redis: redisOk ? 'ok' : 'fail' },
    });
});

// Module routes
router.use('/auth', authRouter);
router.use('/projects', projectsRouter);
router.use('/sprints', sprintsRouter);
router.use('/tasks', tasksRouter);
router.use('/team', teamRouter);
router.use('/scrum-events', scrumEventsRouter);
router.use('/documents', documentsRouter);
router.use('/metrics', metricsRouter);
router.use('/notifications', notificationsRouter);
