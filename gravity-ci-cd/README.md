# Gravity CI/CD

> GitHub Actions pipelines for backend, frontend, staging, production

## Pipelines

| File | Trigger | Actions |
|------|---------|---------|
| `backend-ci.yml` | Push to develop/staging/main (backend/) | Lint → Test → Docker push |
| `frontend-ci.yml` | Push to develop/staging/main (frontend/) | Build → Docker push |
| `deploy-staging.yml` | Push to `staging` branch | Deploy to K8s staging namespace |
| `deploy-prod.yml` | Git tag `v*` | Deploy to K8s prod + auto-rollback on failure |

## Branch Strategy
```
main        ← production (tag releases)
staging     ← staging environment (auto-deploy)
develop     ← integration
feature/*   ← individual features → PR to develop
```

## Required GitHub Secrets
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `GITHUB_TOKEN` (auto-provided)
