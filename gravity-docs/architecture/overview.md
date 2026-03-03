# System Architecture

```mermaid
graph TB
    subgraph Client
        FE[Next.js 14 SPA/PWA]
    end
    subgraph Gateway
        NG[Nginx Reverse Proxy :80]
    end
    subgraph Backend
        API[Node.js REST API v1 :3001]
        AUTH[JWT Auth + Redis Sessions]
    end
    subgraph Data
        PG[(PostgreSQL 16)]
        RED[Redis 7]
    end
    subgraph Observability
        PROM[Prometheus :9090]
        GRAF[Grafana :3002]
    end
    subgraph CICD
        GHA[GitHub Actions]
        GHCR[GitHub Container Registry]
    end
    subgraph Cloud
        K8S[Kubernetes EKS]
        RDS[AWS RDS PostgreSQL]
        S3[AWS S3 Uploads]
    end

    FE --> NG --> API
    API --> AUTH --> RED
    API --> PG
    API --> S3
    API --> PROM
    GHA --> GHCR --> K8S
    K8S --> RDS
