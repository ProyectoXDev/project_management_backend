import 'dotenv/config';
import createApp from './app';
import config from '@config/index';
import logger from '@config/logger';
import db from '@config/database';
import { connectRedis } from '@config/redis';
import fs from 'fs';
import path from 'path';

// Ensure upload dir exists
const uploadDir = path.resolve(config.storage.uploadDir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Ensure logs dir exists
const logsDir = path.resolve('./logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const bootstrap = async (): Promise<void> => {
    try {
        // Test DB connection
        await db.raw('SELECT 1');
        logger.info('PostgreSQL connected');

        // Connect Redis
        await connectRedis();

        const app = createApp();
        app.listen(config.port, () => {
            logger.info(`🚀 Gravity API running on http://localhost:${config.port}${config.apiPrefix}`);
            logger.info(`📖 Swagger docs: http://localhost:${config.port}${config.apiPrefix}/docs`);
            logger.info(`🌍 Env: ${config.env}`);
        });
    } catch (error) {
        logger.error('Failed to start server', { error });
        process.exit(1);
    }
};

bootstrap();
