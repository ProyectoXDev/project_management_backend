import knex, { Knex } from 'knex';
import config from './index';

const knexConfig: Knex.Config = {
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
        directory: './src/infrastructure/database/migrations',
        extension: 'ts',
    },
    seeds: {
        directory: './src/infrastructure/database/seeds',
        extension: 'ts',
    },
};

const db = knex(knexConfig);

export { knexConfig };
export default db;
