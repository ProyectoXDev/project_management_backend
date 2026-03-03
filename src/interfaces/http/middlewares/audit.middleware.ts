import { Request, Response, NextFunction } from 'express';
import db from '@config/database';

export const auditLog =
    (action: string, entity: string) =>
        async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
            next();
            // Fire-and-forget after response
            setImmediate(async () => {
                try {
                    const userId = req.user?.userId;
                    const entityId =
                        req.params.id ||
                        req.params.projectId ||
                        req.params.sprintId ||
                        req.params.taskId ||
                        null;
                    await db('audit_logs').insert({
                        user_id: userId || null,
                        action,
                        entity,
                        entity_id: entityId,
                        payload: JSON.stringify({ body: req.body, query: req.query }),
                        created_at: new Date(),
                    });
                } catch {
                    // never block the request for audit failures
                }
            });
        };
