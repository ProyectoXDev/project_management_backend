# Gravity Infrastructure

> Docker · Kubernetes · Terraform (AWS) · Nginx · Monitoring

## Local Development

```bash
cd docker/
docker-compose up --build -d

# Verify
curl http://localhost:3001/api/v1/health
open http://localhost:3000
open http://localhost:3002   # Grafana (admin/admin)
open http://localhost:9090   # Prometheus
```

## Services
| Service | Port | Description |
|---------|------|-------------|
| Nginx | 80 | Reverse proxy |
| Backend | 3001 | REST API |
| Frontend | 3000 | Next.js |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache / sessions |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3002 | Dashboards |

## Kubernetes

```bash
kubectl apply -f kubernetes/manifests/namespace.yaml
kubectl apply -f kubernetes/manifests/
```

## Terraform (AWS EKS)

```bash
cd terraform/
terraform init
terraform plan -var-file="environments/prod/terraform.tfvars"
terraform apply
```

## DB Backup

```bash
./scripts/db-backup.sh   # runs pg_dump + gzip + optional S3 upload
```
