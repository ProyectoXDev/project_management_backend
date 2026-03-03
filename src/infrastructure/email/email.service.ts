import nodemailer from 'nodemailer';
import config from '@config/index';
import logger from '@config/logger';

export class EmailService {
    private transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        auth: { user: config.email.user, pass: config.email.pass },
    });

    private async send(to: string, subject: string, html: string): Promise<void> {
        try {
            await this.transporter.sendMail({ from: config.email.from, to, subject, html });
        } catch (err) {
            logger.warn('Email send failed', { to, subject, err });
        }
    }

    async sendTaskAssigned(to: string, name: string, taskTitle: string): Promise<void> {
        await this.send(to, `[Gravity] New task assigned`,
            `<p>Hi <b>${name}</b>,</p><p>You have been assigned a new task: <b>${taskTitle}</b></p><p><a href="${config.frontendUrl}/backlog">View Backlog</a></p>`
        );
    }

    async sendQaComment(to: string, name: string, taskTitle: string, comment: string): Promise<void> {
        await this.send(to, `[Gravity] QA comment on your task`,
            `<p>Hi <b>${name}</b>,</p><p>QA left a comment on <b>${taskTitle}</b>:</p><blockquote>${comment}</blockquote><p><a href="${config.frontendUrl}/backlog">View Task</a></p>`
        );
    }

    async sendTaskOverdue(to: string, name: string, taskTitle: string, dueDate: string): Promise<void> {
        await this.send(to, `[Gravity] Task overdue`,
            `<p>Hi <b>${name}</b>,</p><p>Task <b>${taskTitle}</b> was due on <b>${dueDate}</b> and is still not completed.</p><p><a href="${config.frontendUrl}/backlog">View Task</a></p>`
        );
    }
}
