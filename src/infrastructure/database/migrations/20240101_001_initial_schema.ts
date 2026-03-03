import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    // ── ENUM types ─────────────────────────────────────────────────────────────
    await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('admin','pm','dev','qa');
      CREATE TYPE user_status AS ENUM ('active','inactive');
      CREATE TYPE project_type AS ENUM ('closed','open');
      CREATE TYPE sprint_status AS ENUM ('todo','in_progress','done');
      CREATE TYPE task_priority AS ENUM ('low','medium','high','critical');
      CREATE TYPE task_status AS ENUM ('todo','in_progress','done');
      CREATE TYPE scrum_event_type AS ENUM ('planning','review','retro','daily');
      CREATE TYPE doc_category AS ENUM ('backend','frontend','database','design','environments','apis','hu','qa');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END$$;
  `);

    // ── users ──────────────────────────────────────────────────────────────────
    await knex.schema.createTable('users', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.string('name', 100).notNullable();
        t.string('email', 255).notNullable().unique();
        t.string('password_hash', 255).notNullable();
        t.specificType('role', 'user_role').notNullable().defaultTo('dev');
        t.specificType('status', 'user_status').notNullable().defaultTo('active');
        t.timestamps(true, true);
        t.index(['email']);
        t.index(['role']);
    });

    // ── projects ───────────────────────────────────────────────────────────────
    await knex.schema.createTable('projects', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.string('name', 200).notNullable();
        t.text('description');
        t.uuid('pm_id').references('id').inTable('users').onDelete('SET NULL').nullable();
        t.date('start_date').notNullable();
        t.date('end_date').nullable();
        t.specificType('type', 'project_type').notNullable().defaultTo('closed');
        t.decimal('priority_score', 5, 2).defaultTo(0);
        t.decimal('progress', 5, 2).defaultTo(0);
        t.timestamps(true, true);
        t.index(['pm_id']);
        t.index(['type']);
    });

    // ── project_members ────────────────────────────────────────────────────────
    await knex.schema.createTable('project_members', (t) => {
        t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE').notNullable();
        t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
        t.decimal('capacity_pct', 5, 2).defaultTo(100);
        t.primary(['project_id', 'user_id']);
    });

    // ── sprints ────────────────────────────────────────────────────────────────
    await knex.schema.createTable('sprints', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE').notNullable();
        t.string('name', 200).notNullable();
        t.text('goal');
        t.specificType('status', 'sprint_status').notNullable().defaultTo('todo');
        t.date('start_date').notNullable();
        t.date('end_date').notNullable();
        t.decimal('progress', 5, 2).defaultTo(0);
        t.timestamps(true, true);
        t.index(['project_id']);
        t.index(['status']);
    });

    // ── tasks ──────────────────────────────────────────────────────────────────
    await knex.schema.createTable('tasks', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.string('title', 300).notNullable();
        t.text('description');
        t.uuid('assignee_id').references('id').inTable('users').onDelete('SET NULL').nullable();
        t.specificType('priority', 'task_priority').notNullable().defaultTo('medium');
        t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE').notNullable();
        t.uuid('sprint_id').references('id').inTable('sprints').onDelete('SET NULL').nullable();
        t.specificType('status', 'task_status').notNullable().defaultTo('todo');
        t.date('estimated_date').nullable();
        t.timestamps(true, true);
        t.index(['project_id']);
        t.index(['sprint_id']);
        t.index(['assignee_id']);
        t.index(['status']);
        t.index(['priority']);
    });

    // ── task_history ───────────────────────────────────────────────────────────
    await knex.schema.createTable('task_history', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.uuid('task_id').references('id').inTable('tasks').onDelete('CASCADE').notNullable();
        t.uuid('changed_by').references('id').inTable('users').onDelete('SET NULL').nullable();
        t.string('field_name', 100).notNullable();
        t.text('old_value');
        t.text('new_value');
        t.timestamp('changed_at').defaultTo(knex.fn.now());
        t.index(['task_id']);
    });

    // ── task_comments ──────────────────────────────────────────────────────────
    await knex.schema.createTable('task_comments', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.uuid('task_id').references('id').inTable('tasks').onDelete('CASCADE').notNullable();
        t.uuid('author_id').references('id').inTable('users').onDelete('SET NULL').nullable();
        t.text('body').notNullable();
        t.boolean('is_qa').defaultTo(false);
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.index(['task_id']);
    });

    // ── task_attachments ───────────────────────────────────────────────────────
    await knex.schema.createTable('task_attachments', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.uuid('task_id').references('id').inTable('tasks').onDelete('CASCADE').notNullable();
        t.string('filename', 300).notNullable();
        t.string('url', 500).notNullable();
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.index(['task_id']);
    });

    // ── task_migrations ────────────────────────────────────────────────────────
    await knex.schema.createTable('task_migrations', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.uuid('task_id').references('id').inTable('tasks').onDelete('CASCADE').notNullable();
        t.uuid('from_sprint_id').references('id').inTable('sprints').onDelete('SET NULL').nullable();
        t.uuid('to_sprint_id').references('id').inTable('sprints').onDelete('SET NULL').nullable();
        t.text('reason').notNullable();
        t.uuid('migrated_by').references('id').inTable('users').onDelete('SET NULL').nullable();
        t.timestamp('migrated_at').defaultTo(knex.fn.now());
        t.index(['task_id']);
    });

    // ── scrum_events ───────────────────────────────────────────────────────────
    await knex.schema.createTable('scrum_events', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE').notNullable();
        t.string('title', 300).notNullable();
        t.specificType('type', 'scrum_event_type').notNullable();
        t.text('content_md');
        t.uuid('created_by').references('id').inTable('users').onDelete('SET NULL').nullable();
        t.date('event_date').notNullable();
        t.timestamps(true, true);
        t.index(['project_id']);
        t.index(['type']);
    });

    // ── scrum_event_files ──────────────────────────────────────────────────────
    await knex.schema.createTable('scrum_event_files', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.uuid('event_id').references('id').inTable('scrum_events').onDelete('CASCADE').notNullable();
        t.string('filename', 300).notNullable();
        t.string('url', 500).notNullable();
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.index(['event_id']);
    });

    // ── documents ──────────────────────────────────────────────────────────────
    await knex.schema.createTable('documents', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE').notNullable();
        t.string('title', 300).notNullable();
        t.specificType('category', 'doc_category').notNullable();
        t.text('content_md');
        t.integer('version').defaultTo(1);
        t.uuid('uploaded_by').references('id').inTable('users').onDelete('SET NULL').nullable();
        t.timestamps(true, true);
        t.index(['project_id']);
        t.index(['category']);
    });

    // ── audit_logs ─────────────────────────────────────────────────────────────
    await knex.schema.createTable('audit_logs', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.uuid('user_id').references('id').inTable('users').onDelete('SET NULL').nullable();
        t.string('action', 100).notNullable();
        t.string('entity', 100).notNullable();
        t.string('entity_id', 100).nullable();
        t.jsonb('payload');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.index(['user_id']);
        t.index(['entity']);
        t.index(['created_at']);
    });

    // ── notifications ──────────────────────────────────────────────────────────
    await knex.schema.createTable('notifications', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
        t.text('message').notNullable();
        t.string('type', 50).notNullable().defaultTo('info');
        t.boolean('read').defaultTo(false);
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.index(['user_id']);
        t.index(['read']);
    });

    // ── metrics_cache ──────────────────────────────────────────────────────────
    await knex.schema.createTable('metrics_cache', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE').notNullable();
        t.uuid('sprint_id').references('id').inTable('sprints').onDelete('SET NULL').nullable();
        t.string('metric_key', 100).notNullable();
        t.decimal('metric_value', 10, 4);
        t.timestamp('computed_at').defaultTo(knex.fn.now());
        t.index(['project_id', 'metric_key']);
    });
}

export async function down(knex: Knex): Promise<void> {
    const tables = [
        'metrics_cache', 'notifications', 'audit_logs', 'documents',
        'scrum_event_files', 'scrum_events', 'task_migrations', 'task_attachments',
        'task_comments', 'task_history', 'tasks', 'sprints',
        'project_members', 'projects', 'users',
    ];
    for (const table of tables) {
        await knex.schema.dropTableIfExists(table);
    }
    await knex.raw(`
    DROP TYPE IF EXISTS user_role, user_status, project_type, sprint_status,
    task_priority, task_status, scrum_event_type, doc_category CASCADE;
  `);
}
