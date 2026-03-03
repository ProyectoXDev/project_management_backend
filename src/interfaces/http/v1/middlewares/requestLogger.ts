import { Request, Response, NextFunction } from 'express';
import { db } from '../../../../infrastructure/database/connection';
import { logger } from '../../../../config/logger';

export const requestLogger = async (req: Request, res: Response, next: NextFunction) => {
    // Audit log on mutations
    const shouldLog = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (shouldLog && req.user) {
        const entity = req.path.split('/')[1] || 'unknown';
        const entityId = req.params?.id || null;
        try {
            await db('audit_logs').insert({
                user_id: req.user.userId,
                action: req.method,
                entity,
                entity_id: entityId,
                payload: JSON.stringify(req.body || {}),
                ip_address: req.ip,
            });
        } catch (e) {
            logger.warn('Audit log insert failed', e);
        }
    }
    next();
};
