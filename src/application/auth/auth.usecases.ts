import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '@infrastructure/repositories/user.repository';
import redisClient from '@config/redis';
import config from '@config/index';

interface LoginDTO { email: string; password: string; }
interface TokenPair { accessToken: string; refreshToken: string; user: object; }

const userRepo = new UserRepository();

export class LoginUseCase {
    async execute({ email, password }: LoginDTO): Promise<TokenPair> {
        const user = await userRepo.findByEmail(email);
        if (!user || user.status === 'inactive') throw new Error('Invalid credentials');

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) throw new Error('Invalid credentials');

        const payload = { userId: user.id, email: user.email, role: user.role };
        const accessToken = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as string });
        const refreshToken = uuidv4();

        // Store refresh token in Redis (TTL 7 days)
        await redisClient.setEx(`refresh:${refreshToken}`, 7 * 24 * 3600, user.id);

        return {
            accessToken,
            refreshToken,
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        };
    }
}

export class RefreshTokenUseCase {
    async execute(refreshToken: string): Promise<{ accessToken: string }> {
        const userId = await redisClient.get(`refresh:${refreshToken}`);
        if (!userId) throw new Error('Invalid refresh token');

        const user = await userRepo.findById(userId);
        if (!user || user.status === 'inactive') throw new Error('User not found');

        const payload = { userId: user.id, email: user.email, role: user.role };
        const accessToken = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as string });

        // Rotate refresh token
        await redisClient.del(`refresh:${refreshToken}`);
        const newRefreshToken = uuidv4();
        await redisClient.setEx(`refresh:${newRefreshToken}`, 7 * 24 * 3600, user.id);

        return { accessToken };
    }
}

export class LogoutUseCase {
    async execute(refreshToken: string): Promise<void> {
        await redisClient.del(`refresh:${refreshToken}`);
    }
}

export class GetMeUseCase {
    async execute(userId: string): Promise<object> {
        const user = await userRepo.findById(userId);
        if (!user) throw new Error('User not found');
        const { password_hash: _, ...safe } = user;
        return safe;
    }
}
