import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

import config from '@config/index';
import logger from '@config/logger';

// Routes
import authRoutes from '@interfaces/http/v1/auth/auth.routes';
import projectRoutes from '@interfaces/http/v1/project/project.routes';
import sprintRoutes from '@interfaces/http/v1/sprint/sprint.routes';
import taskRoutes from '@interfaces/http/v1/task/task.routes';
import teamRoutes from '@interfaces/http/v1/team/team.routes';
import scrumEventRoutes from '@interfaces/http/v1/scrum-event/scrumEvent.routes';
import documentRoutes from '@interfaces/http/v1/document/document.routes';
import metricRoutes from '@interfaces/http/v1/metric/metric.routes';
import notificationRoutes from '@interfaces/http/v1/notification/notification.routes';

// Swagger
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const createApp = (): Application => {
    const app = express();

    // Disable ETag — prevents 304 responses that serve stale data after mutations
    app.set('etag', false);

    // ── Security ──────────────────────────────────────────────────────────────
    app.use(helmet());
    app.use(
        cors({
            origin: config.frontendUrl,
            credentials: true,
        })
    );

    // ── Rate limiting ─────────────────────────────────────────────────────────
    app.use(
        rateLimit({
            windowMs: 15 * 60 * 1000, // 15 min
            max: 200,
            standardHeaders: true,
            legacyHeaders: false,
        })
    );

    // ── Body parsing & compression ────────────────────────────────────────────
    app.use(compression());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // ── HTTP logging ──────────────────────────────────────────────────────────
    app.use(
        morgan('combined', {
            stream: { write: (msg) => logger.http(msg.trim()) },
        })
    );

    // ── Static uploads ────────────────────────────────────────────────────────
    app.use('/uploads', express.static(path.resolve(config.storage.uploadDir)));

    // ── Health ────────────────────────────────────────────────────────────────
    app.get(`${config.apiPrefix}/health`, (_req: Request, res: Response) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
    });

    // ── Swagger ───────────────────────────────────────────────────────────────
    try {
        const swaggerDoc = YAML.load(path.join(__dirname, '../interfaces/swagger/openapi.yaml'));
        app.use(`${config.apiPrefix}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    } catch {
        logger.warn('OpenAPI spec not found — Swagger UI disabled');
    }

    // ── API Routes ────────────────────────────────────────────────────────────
    app.use(`${config.apiPrefix}/auth`, authRoutes);
    app.use(`${config.apiPrefix}/projects`, projectRoutes);
    app.use(`${config.apiPrefix}/sprints`, sprintRoutes);
    app.use(`${config.apiPrefix}/tasks`, taskRoutes);
    app.use(`${config.apiPrefix}/team`, teamRoutes);
    app.use(`${config.apiPrefix}/scrum-events`, scrumEventRoutes);
    app.use(`${config.apiPrefix}/documents`, documentRoutes);
    app.use(`${config.apiPrefix}/metrics`, metricRoutes);
    app.use(`${config.apiPrefix}/notifications`, notificationRoutes);

    // ── 404 ───────────────────────────────────────────────────────────────────
    app.use((_req: Request, res: Response) => {
        res.status(404).json({ success: false, message: 'Route not found' });
    });

    // ── Global error handler ──────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        logger.error(err.message, { stack: err.stack });
        res.status(500).json({ success: false, message: 'Internal server error' });
    });

    return app;
};

export default createApp;
