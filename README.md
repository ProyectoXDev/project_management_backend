# Gravity Backend

> Enterprise REST API — Node.js + TypeScript + Clean Architecture

## Tech Stack
- **Runtime**: Node.js 20 + TypeScript 5
- **Framework**: Express 4
- **Database**: PostgreSQL 16 via Knex.js
- **Cache / Sessions**: Redis 7
- **Auth**: JWT (access + refresh with rotation)
- **Email**: Nodemailer
- **Files**: Multer (local dev) / S3 (prod)
- **Docs**: Swagger UI — OpenAPI 3.0
- **Logging**: Winston + Morgan

## Quick Start

```bash
# 1. Install deps
npm install

# 2. Copy env
cp .env.example .env  # adjust values

# 3. Start dependencies
docker-compose -f ../gravity-infra/docker/docker-compose.yml up postgres redis -d

# 4. Run migrations + seed
npm run migrate
npm run seed

# 5. Start dev server
npm run dev
# → http://localhost:3001/api/v1
# → http://localhost:3001/api/v1/docs  (Swagger)
```

## API Modules
| Route | Description |
|-------|-------------|
| `/auth` | Login, refresh, logout, /me |
| `/projects` | CRUD + priority calc + progress |
| `/sprints` | CRUD + task migration with reason |
| `/tasks` | CRUD + Kanban + comments + attachments + history |
| `/team` | User CRUD + capacity |
| `/scrum-events` | Meeting notes + Markdown + file upload |
| `/documents` | CRUD + templates (QA/HU) + Markdown render |
| `/metrics` | Dashboard, burndown, velocity, productivity |
| `/notifications` | List + mark read |

## Default Credentials (seed data)
| Email | Password | Role |
|-------|----------|------|
| admin@gravity.io | Admin1234! | Admin |
| pm@gravity.io | Dev1234! | PM |
| dev@gravity.io | Dev1234! | Dev |
| qa@gravity.io | Dev1234! | QA |

## Architecture
```
src/
├── domain/          # Entities + interfaces (no deps)
├── application/     # Use cases
├── infrastructure/  # DB, email, storage implementations
├── interfaces/      # Express controllers, routes, middlewares
└── config/          # env, db, logger, redis
```
