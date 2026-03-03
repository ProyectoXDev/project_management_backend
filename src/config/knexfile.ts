import path from 'path';
import 'dotenv/config';
import config from './index';

const ROOT = path.resolve(__dirname, '../../..');

const knexConfig = {
    client: 'pg',
    connection: {
        host: config.db.host,
        port: config.db.port,
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
    },
    pool: { min: 2, max: 20 },
    migrations: {
        directory: path.join(ROOT, 'src/infrastructure/database/migrations'),
        extension: 'ts',
    },
    seeds: {
        directory: path.join(ROOT, 'src/infrastructure/database/seeds'),
        extension: 'ts',
    },
};

export { knexConfig };
export default knexConfig;

module.exports = knexConfig;
