import { Request, Response } from 'express';
import db from '@config/database';
import { eachDayOfInterval, format } from 'date-fns';

// Helper: Postgres can return Date objects or ISO strings — normalise to 'yyyy-MM-dd'
const toDateStr = (v: Date | string | null | undefined): string | null => {
  if (!v) return null;
  try {
    const d = v instanceof Date ? v : new Date(v);
    return format(d, 'yyyy-MM-dd');
  } catch {
    return null;
  }
};

export class MetricController {
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, sprintId } = req.query as Record<string, string>;

      if (!projectId && !sprintId) {
        res.status(400).json({ success: false, message: 'projectId or sprintId required' });
        return;
      }

      // Active sprint
      const sprint = sprintId
        ? await db('sprints').where('id', sprintId).first()
        : await db('sprints').where({ project_id: projectId, status: 'in_progress' }).first();

      const tasks = sprint ? await db('tasks').where('sprint_id', sprint.id) : [];
      const total = tasks.length;
      const done = tasks.filter((t: any) => t.status === 'done').length;
      const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
      const overdue = tasks.filter((t: any) => t.estimated_date && new Date(t.estimated_date) < new Date() && t.status !== 'done').length;

      // Velocity (tasks done per sprint, last 5)
      const sprintHistory = await db('sprints')
        .where({ project_id: projectId, status: 'done' })
        .select('id').orderBy('end_date', 'desc').limit(5);
      const velocity: number[] = [];
      for (const s of sprintHistory) {
        const sprintDone = await db('tasks').where({ sprint_id: s.id, status: 'done' }).count('id as c').first();
        velocity.push(Number((sprintDone as any)?.c || 0));
      }

      // Burndown data — FIX: normalise Postgres Date → string before eachDayOfInterval
      const burndown: { date: string; remaining: number }[] = [];
      if (sprint) {
        const startStr = toDateStr(sprint.start_date);
        const endStr = toDateStr(sprint.end_date);
        if (startStr && endStr) {
          const start = new Date(startStr);
          const end = new Date(endStr);
          if (start <= end) {
            const days = eachDayOfInterval({ start, end });
            for (const day of days) {
              const dayStr = format(day, 'yyyy-MM-dd');
              const remaining = await db('tasks')
                .where('sprint_id', sprint.id)
                .where('status', '!=', 'done')
                .whereRaw(`DATE(created_at) <= ?`, [dayStr])
                .count('id as c').first();
              burndown.push({ date: dayStr, remaining: Number((remaining as any)?.c || 0) });
            }
          }
        }
      }

      // Team productivity
      const productivity = await db('tasks')
        .where({ 'tasks.project_id': projectId, 'tasks.status': 'done' })
        .join('users', 'tasks.assignee_id', 'users.id')
        .groupBy('users.id', 'users.name')
        .select('users.id', 'users.name', db.raw('COUNT(tasks.id) as tasks_done'));

      // Migration rate
      const migrations = await db('task_migrations')
        .join('tasks', 'task_migrations.task_id', 'tasks.id')
        .where('tasks.project_id', projectId)
        .count('task_migrations.id as count').first();

      // Project progress (from DB, recalculated on task changes)
      const project = projectId ? await db('projects').where('id', projectId).select('progress', 'priority_score').first() : null;

      res.json({
        success: true,
        data: {
          sprint: sprint
            ? { id: sprint.id, name: sprint.name, status: sprint.status, progress: sprint.progress }
            : null,
          summary: { total, done, inProgress, overdue, pctComplete: total ? Math.round((done / total) * 100) : 0 },
          velocity: velocity.reverse(),
          burndown,
          productivity,
          migrationCount: Number((migrations as any)?.count || 0),
          projectProgress: project?.progress ?? 0,
          projectPriority: Number(project?.priority_score ?? 0).toFixed(1),
        },
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  }
}
