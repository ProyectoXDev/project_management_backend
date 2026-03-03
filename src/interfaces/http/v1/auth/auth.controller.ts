import { Request, Response } from 'express';
import { LoginUseCase, RefreshTokenUseCase, LogoutUseCase, GetMeUseCase } from '@application/auth/auth.usecases';

const loginUC = new LoginUseCase();
const refreshUC = new RefreshTokenUseCase();
const logoutUC = new LogoutUseCase();
const getMeUC = new GetMeUseCase();

export class AuthController {
    async login(req: Request, res: Response): Promise<void> {
        try {
            const result = await loginUC.execute(req.body);
            res.json({ success: true, data: result });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Login failed';
            res.status(401).json({ success: false, message });
        }
    }

    async refresh(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body;
            const result = await refreshUC.execute(refreshToken);
            res.json({ success: true, data: result });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Refresh failed';
            res.status(401).json({ success: false, message });
        }
    }

    async logout(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body;
            await logoutUC.execute(refreshToken);
            res.json({ success: true, message: 'Logged out' });
        } catch {
            res.status(500).json({ success: false, message: 'Logout failed' });
        }
    }

    async me(req: Request, res: Response): Promise<void> {
        try {
            const user = await getMeUC.execute(req.user!.userId);
            res.json({ success: true, data: user });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Not found';
            res.status(404).json({ success: false, message });
        }
    }
}
