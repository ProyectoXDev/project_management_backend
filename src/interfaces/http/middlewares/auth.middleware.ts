import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '@config/index';

export interface AuthPayload {
    userId: string;
    email: string;
    role: 'admin' | 'pm' | 'dev' | 'qa';
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'No token provided' });
        return;
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, config.jwt.secret) as AuthPayload;
        req.user = payload;
        next();
    } catch {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};
