import { Request, Response, NextFunction } from 'express';
import { AuthPayload } from './auth.middleware';

type Role = 'admin' | 'pm' | 'dev' | 'qa';

export const authorize =
    (...roles: Role[]) =>
        (req: Request, res: Response, next: NextFunction): void => {
            const user = req.user as AuthPayload | undefined;
            if (!user) {
                res.status(401).json({ success: false, message: 'Unauthenticated' });
                return;
            }
            if (!roles.includes(user.role)) {
                res.status(403).json({ success: false, message: 'Insufficient permissions' });
                return;
            }
            next();
        };
