import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function seed(knex: Knex): Promise<void> {
    // Clean data (order matters due to FK constraints)
    await knex('metrics_cache').del();
    await knex('notifications').del();
    await knex('audit_logs').del();
    await knex('documents').del();
    await knex('scrum_event_files').del();
    await knex('scrum_events').del();
    await knex('task_migrations').del();
    await knex('task_attachments').del();
    await knex('task_comments').del();
    await knex('task_history').del();
    await knex('tasks').del();
    await knex('sprints').del();
    await knex('project_members').del();
    await knex('projects').del();
    await knex('users').del();

    const adminId = uuidv4();
    const pmId = uuidv4();
    const devId = uuidv4();
    const qaId = uuidv4();
    const projectId = uuidv4();
    const sprintId = uuidv4();
    const taskId1 = uuidv4();
    const taskId2 = uuidv4();

    const passwordHash = await bcrypt.hash('Admin1234!', 12);
    const devHash = await bcrypt.hash('Dev1234!', 12);

    // ── Users ──────────────────────────────────────────────────────────────────
    await knex('users').insert([
        { id: adminId, name: 'Admin Gravity', email: 'admin@gravity.io', password_hash: passwordHash, role: 'admin', status: 'active' },
        { id: pmId, name: 'Product Manager', email: 'pm@gravity.io', password_hash: devHash, role: 'pm', status: 'active' },
        { id: devId, name: 'Developer One', email: 'dev@gravity.io', password_hash: devHash, role: 'dev', status: 'active' },
        { id: qaId, name: 'QA Engineer', email: 'qa@gravity.io', password_hash: devHash, role: 'qa', status: 'active' },
    ]);

    // ── Project ────────────────────────────────────────────────────────────────
    await knex('projects').insert({
        id: projectId,
        name: 'Gravity PMS — Phase 1',
        description: 'Initial project management system build.',
        pm_id: pmId,
        start_date: '2024-01-01',
        end_date: '2024-06-30',
        type: 'closed',
        priority_score: 85.5,
        progress: 30,
    });

    // ── Project members ────────────────────────────────────────────────────────
    await knex('project_members').insert([
        { project_id: projectId, user_id: pmId, capacity_pct: 100 },
        { project_id: projectId, user_id: devId, capacity_pct: 80 },
        { project_id: projectId, user_id: qaId, capacity_pct: 50 },
    ]);

    // ── Sprint ─────────────────────────────────────────────────────────────────
    await knex('sprints').insert({
        id: sprintId,
        project_id: projectId,
        name: 'Sprint 1 — Core Backend',
        goal: 'Implement auth, projects, and tasks API',
        status: 'in_progress',
        start_date: '2024-01-08',
        end_date: '2024-01-22',
        progress: 45,
    });

    // ── Tasks ──────────────────────────────────────────────────────────────────
    await knex('tasks').insert([
        {
            id: taskId1,
            title: 'Setup project skeleton & CI pipeline',
            description: 'Initialize repos, Docker, GitHub Actions pipelines',
            assignee_id: devId,
            priority: 'high',
            project_id: projectId,
            sprint_id: sprintId,
            status: 'done',
            estimated_date: '2024-01-12',
        },
        {
            id: taskId2,
            title: 'Implement JWT authentication module',
            description: 'Login, refresh tokens, logout endpoints',
            assignee_id: devId,
            priority: 'critical',
            project_id: projectId,
            sprint_id: sprintId,
            status: 'in_progress',
            estimated_date: '2024-01-18',
        },
    ]);

    // ── Task comment ───────────────────────────────────────────────────────────
    await knex('task_comments').insert({
        task_id: taskId2,
        author_id: qaId,
        body: 'Please add refresh token rotation to the implementation.',
        is_qa: true,
    });

    // ── Scrum event ────────────────────────────────────────────────────────────
    await knex('scrum_events').insert({
        project_id: projectId,
        title: 'Sprint 1 Planning',
        type: 'planning',
        content_md: '# Sprint 1 Planning\n\n## Goal\nImplement core backend modules.\n\n## Tasks selected\n- JWT auth\n- Project CRUD\n- CI setup',
        created_by: pmId,
        event_date: '2024-01-07',
    });

    // ── Document ───────────────────────────────────────────────────────────────
    await knex('documents').insert({
        project_id: projectId,
        title: 'API Architecture Overview',
        category: 'backend',
        content_md: '# Backend Architecture\n\nClean Architecture with domain separation...',
        version: 1,
        uploaded_by: adminId,
    });

    // ── Notification ───────────────────────────────────────────────────────────
    await knex('notifications').insert({
        user_id: devId,
        message: 'You have been assigned a new task: Implement JWT authentication module',
        type: 'task_assigned',
        read: false,
    });
}
