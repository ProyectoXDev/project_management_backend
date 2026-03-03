import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Gravity PMS API',
            version: '1.0.0',
            description: 'Enterprise Project Management System REST API',
            contact: { name: 'Gravity Team', email: 'api@gravity.io' },
        },
        servers: [
            { url: 'http://localhost:3001/api/v1', description: 'Development' },
            { url: 'https://api.gravity.io/api/v1', description: 'Production' },
        ],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
        },
        security: [{ bearerAuth: [] }],
        tags: [
            { name: 'Auth', description: 'Authentication and authorization' },
            { name: 'Projects', description: 'Project management' },
            { name: 'Sprints', description: 'Sprint management' },
            { name: 'Tasks', description: 'Task/backlog management' },
            { name: 'Team', description: 'Team member management' },
            { name: 'Scrum Events', description: 'Meeting notes and scrum ceremonies' },
            { name: 'Documents', description: 'Documentation and file management' },
            { name: 'Metrics', description: 'KPIs, dashboards, and analytics' },
            { name: 'Notifications', description: 'User notifications' },
        ],
    },
    apis: ['./src/interfaces/http/v1/controllers/*.ts'],
};

export const setupSwagger = (app: Express) => {
    const spec = swaggerJsdoc(options);
    app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(spec, {
        customSiteTitle: 'Gravity API Docs',
        customCss: '.swagger-ui .topbar { background-color: #1a1a2e; }',
    }));
    app.get('/api/v1/docs.json', (_req, res) => res.json(spec));
};
