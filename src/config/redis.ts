import { createClient } from 'redis';
import config from './index';
import logger from './logger';

const redisClient = createClient({
    socket: {
        host: config.redis.host,
        port: config.redis.port,
    },
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info('Redis connected'));

export const connectRedis = async (): Promise<void> => {
    await redisClient.connect();
};

export default redisClient;
