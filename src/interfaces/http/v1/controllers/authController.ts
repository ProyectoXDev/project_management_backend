import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { db } from '../../../../infrastructure/database/connection';
import { redisClient } from '../../../../config/redis';
import { AppError } from '../middlewares/errorHandler';
import { authenticate } from '../middlewares/auth';

export const authRouter = Router();

const generateTokens = (payload: { userId: string; email: string; role: string }) => {
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    } as any);
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    } as any);
    return { accessToken, refreshToken };
};

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens returned
 *       401:
 *         description: Invalid credentials
 */
authRouter.post('/login',
    [body('email').isEmail(), body('password').notEmpty()],
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next(new AppError('Validation error: ' + JSON.stringify(errors.array()), 400));

        const { email, password } = req.body;
        const user = await db('users').where({ email, status: 'active' }).first();
        if (!user) return next(new AppError('Invalid credentials', 401));

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return next(new AppError('Invalid credentials', 401));

        const { accessToken, refreshToken } = generateTokens({ userId: user.id, email: user.email, role: user.role });

        // Store refresh token in Redis
        await redisClient.setEx(`refresh:${user.id}`, 7 * 24 * 3600, refreshToken);

        res.json({
            success: true,
            data: {
                accessToken,
                refreshToken,
                user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url },
            },
        });
    }
);

authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(new AppError('Refresh token required', 400));

    try {
        const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
        const stored = await redisClient.get(`refresh:${payload.userId}`);
        if (stored !== refreshToken) return next(new AppError('Refresh token revoked', 401));

        const { accessToken, refreshToken: newRefresh } = generateTokens({
            userId: payload.userId, email: payload.email, role: payload.role,
        });
        await redisClient.setEx(`refresh:${payload.userId}`, 7 * 24 * 3600, newRefresh);

        res.json({ success: true, data: { accessToken, refreshToken: newRefresh } });
    } catch {
        return next(new AppError('Invalid refresh token', 401));
    }
});

authRouter.post('/logout', authenticate, async (req: Request, res: Response) => {
    await redisClient.del(`refresh:${req.user!.userId}`);
    res.json({ success: true, message: 'Logged out successfully' });
});

authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    const user = await db('users').where({ id: req.user!.userId }).select('id', 'name', 'email', 'role', 'status', 'avatar_url', 'created_at').first();
    if (!user) return next(new AppError('User not found', 404));
    res.json({ success: true, data: user });
});
