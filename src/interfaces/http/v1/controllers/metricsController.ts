import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../../../infrastructure/database/connection';
import { authenticate } from '../middlewares/auth';

export const metricsRouter = Router();

// GET /metrics/dashboard?project_id=
metricsRouter.get('/dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const projectId = req.query.project_id as string;
        const baseTaskQ = db('tasks').modify((q) => { if (projectId) q.where({ project_id: projectId }); });

        const [totalTasks, doneTasks, inProgressTasks, overdueTasks] = await Promise.all([
            db('tasks').modify((q) => { if (projectId) q.where({ project_id: projectId }); }).count('id as c').first(),
            db('tasks').where({ status: 'done' }).modify((q) => { if (projectId) q.where({ project_id: projectId }); }).count('id as c').first(),
            db('tasks').where({ status: 'in_progress' }).modify((q) => { if (projectId) q.where({ project_id: projectId }); }).count('id as c').first(),
            db('tasks').where('status', '!=', 'done').where('estimated_date', '<', db.fn.now()).modify((q) => { if (projectId) q.where({ project_id: projectId }); }).count('id as c').first(),
        ]);

        // Sprint velocity: tasks completed per sprint
        const sprintQ = db('sprints as s')
            .join('tasks as t', 't.sprint_id', 's.id')
            .select('s.id', 's.name', 's.sprint_number', 's.project_id')
            .count('t.id as total_tasks')
            .sum(db.raw('CASE WHEN t.status = \'done\' THEN 1 ELSE 0 END as completed_tasks'))
            .sum(db.raw('CASE WHEN t.status = \'done\' THEN t.story_points ELSE 0 END as velocity'))
            .groupBy('s.id', 's.name', 's.sprint_number', 's.project_id')
            .orderBy('s.sprint_number');
        if (projectId) sprintQ.where('s.project_id', projectId);
        const sprintData = await sprintQ;

        // Team productivity
        const productivityQ = db('tasks as t')
            .join('users as u', 't.assignee_id', 'u.id')
            .select('u.id', 'u.name', 'u.role')
            .count('t.id as total_assigned')
            .sum(db.raw('CASE WHEN t.status = \'done\' THEN 1 ELSE 0 END as completed'))
            .sum(db.raw('CASE WHEN t.status != \'done\' AND t.estimated_date < NOW() THEN 1 ELSE 0 END as overdue'))
            .groupBy('u.id', 'u.name', 'u.role');
        if (projectId) productivityQ.where('t.project_id', projectId);
        const productivity = await productivityQ;

        // Team capacity per project
        const capacityQ = db('project_members as pm')
            .join('users as u', 'pm.user_id', 'u.id')
            .join('projects as p', 'pm.project_id', 'p.id')
            .select('u.id', 'u.name', 'p.name as project_name', 'pm.capacity_pct')
            .where('p.is_active', true);
        if (projectId) capacityQ.where('pm.project_id', projectId);
        const capacity = await capacityQ;

        // Task migration average
        const migrationAvg = await db('task_migrations')
            .modify((q) => {
                if (projectId) {
                    q.join('tasks', 'task_migrations.task_id', 'tasks.id').where('tasks.project_id', projectId);
                }
            })
            .count('id as total_migrations').first();

        // Burndown: tasks per status per day (last 30 days)
        const burndown = await db('task_history')
            .where('field_name', 'status')
            .where('new_value', 'done')
            .where('changed_at', '>=', db.raw("NOW() - INTERVAL '30 days'"))
            .modify((q) => {
                if (projectId) q.join('tasks', 'task_history.task_id', 'tasks.id').where('tasks.project_id', projectId);
            })
            .select(db.raw('DATE(changed_at) as date'))
            .count('id as completed_count')
            .groupBy(db.raw('DATE(changed_at)'))
            .orderBy('date');

        res.json({
            success: true,
            data: {
                summary: {
                    total_tasks: parseInt((totalTasks as any).c),
                    done_tasks: parseInt((doneTasks as any).c),
                    in_progress_tasks: parseInt((inProgressTasks as any).c),
                    overdue_tasks: parseInt((overdueTasks as any).c),
                    completion_rate: totalTasks
                        ? Math.round((parseInt((doneTasks as any).c) / parseInt((totalTasks as any).c)) * 100)
                        : 0,
                    total_migrations: parseInt((migrationAvg as any).total_migrations || '0'),
                },
                sprint_velocity: sprintData,
                team_productivity: productivity,
                team_capacity: capacity,
                burndown,
            }
        });
    } catch (e) { next(e); }
});

// GET /metrics/projects — project KPIs overview
metricsRouter.get('/projects', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const projects = await db('projects as p')
            .where('p.is_active', true)
            .leftJoin('users as pm', 'p.pm_id', 'pm.id')
            .select('p.id', 'p.name', 'p.type', 'p.end_date', 'p.progress', 'p.priority_score', 'pm.name as pm_name');

        const result = await Promise.all(projects.map(async (p: any) => {
            const tasks = await db('tasks').where({ project_id: p.id })
                .select('status', 'estimated_date', db.raw('now() as now'));
            const total = tasks.length;
            const done = tasks.filter((t: any) => t.status === 'done').length;
            const overdue = tasks.filter((t: any) => t.status !== 'done' && t.estimated_date && new Date(t.estimated_date) < new Date()).length;
            const sprints = await db('sprints').where({ project_id: p.id });
            const currentSprint = sprints.find((s: any) => s.status === 'in_progress') || null;
            return { ...p, total_tasks: total, completed_tasks: done, overdue_tasks: overdue, current_sprint: currentSprint?.name || null, sprint_count: sprints.length };
        }));

        res.json({ success: true, data: result });
    } catch (e) { next(e); }
});
