#!/usr/bin/env node
/**
 * Direct migration + seed runner using ts-node programmatically.
 * Avoids Knex CLI path issues entirely.
 */

// Load env from backend root
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Register ts-node to handle .ts files
require('ts-node').register({
    project: require('path').join(__dirname, '../tsconfig.json'),
    transpileOnly: true,
});

const path = require('path');
const Knex = require('knex');

const ROOT = path.join(__dirname, '..');

const db = Knex({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'gravity_db',
        user: process.env.DB_USER || 'gravity_user',
        password: process.env.DB_PASSWORD || 'gravity_pass',
    },
    migrations: { directory: path.join(ROOT, 'src/infrastructure/database/migrations'), extension: 'ts' },
    seeds: { directory: path.join(ROOT, 'src/infrastructure/database/seeds'), extension: 'ts' },
});

const action = process.argv[2] || 'migrate';

(async () => {
    try {
        if (action === 'migrate') {
            console.log('▶ Running migrations...');
            const [batch, files] = await db.migrate.latest();
            if (files.length === 0) {
                console.log('✅ Already up to date.');
            } else {
                console.log(`✅ Batch ${batch} — ran: ${files.map(f => require('path').basename(f)).join(', ')}`);
            }
        } else if (action === 'seed') {
            console.log('▶ Running seeds...');
            const [files] = await db.seed.run();
            console.log(`✅ Seeds: ${files.map(f => require('path').basename(f)).join(', ')}`);
        } else if (action === 'rollback') {
            console.log('▶ Rolling back...');
            const [batch, files] = await db.migrate.rollback();
            console.log(`✅ Rollback batch ${batch}: ${files.map(f => require('path').basename(f)).join(', ')}`);
        }
    } catch (err) {
        console.error('❌', err.message);
        process.exit(1);
    } finally {
        await db.destroy();
    }
})();
