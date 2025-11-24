# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**玄武工厂平台** (Xuanwu Factory Platform) - A cloud-native application management platform built with Next.js 16, managing containerized services, Kubernetes resources, and AI-driven requirements.

## Core Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript 5
- **Database**: MySQL 8.0+ with Prisma ORM
- **UI**: React 19, Radix UI components, TailwindCSS
- **Infrastructure**: Kubernetes client (`@kubernetes/client-node`), Docker
- **Build**: Jenkins CI/CD integration
- **Package Manager**: pnpm (inferred from pnpm-lock.yaml)

## Development Commands

```bash
# Install dependencies
pnpm install

# Run development server (http://localhost:3000)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint
```

## Database Operations

```bash
# Generate Prisma client (auto-runs on install)
npx prisma generate

# Create new migration
npx prisma migrate dev --name <migration_name>

# Apply migrations in production
npx prisma migrate deploy

# Open Prisma Studio for data inspection
npx prisma studio

# Reset database (development only)
npx prisma migrate reset
```

**Important**: The `postinstall` script automatically runs `prisma generate` with multi-platform binary targets. Set `SKIP_PRISMA_GENERATE=true` to bypass.

## Docker & Deployment

```bash
# Build Docker image with auto-generated tag (YYMMDD-HHMMSS)
./scripts/build-docker.sh

# Build and push to registry
PUSH_IMAGE=true IMAGE_TAG=v1.0.0 REGISTRY=nexus.aimstek.cn ./scripts/build-docker.sh

# Build and test locally
TEST_LOCAL=true DATABASE_URL=<your_db_url> ./scripts/build-docker.sh

# Deploy to Kubernetes
kubectl apply -f k8s-deployment.yaml

# Check deployment status
kubectl get pods -n xuanwu-factory
kubectl logs -f deployment/xuanwu-factory -n xuanwu-factory
```

**Note**: The build script automatically updates `k8s-deployment.yaml` with the newly built image.

## Environment Configuration

### Required Variables

- `DATABASE_URL`: MySQL connection string for Prisma
  - Format: `mysql://username:password@host:port/database`

### Kubernetes Management (Optional)

Choose one authentication method:

**Method 1: Full kubeconfig**
- `KUBECONFIG_DATA`: Complete kubeconfig content (YAML or Base64)

**Method 2: Token-based auth**
- `K8S_API_SERVER`: Kubernetes API server URL
- `K8S_BEARER_TOKEN`: Bearer token for authentication
- `K8S_CA_CERT_DATA`: Base64-encoded CA certificate (optional)
- `K8S_SKIP_TLS_VERIFY`: Set to `true` if no CA cert provided

Generate admin token using: `./doc/k8s/generate-admin-token.sh`

### Jenkins Integration (Optional)

- `JENKINS_BASE_URL`: Jenkins server URL
- `JENKINS_USER`: Jenkins username
- `JENKINS_API_TOKEN`: Jenkins API token
- `JENKINS_JOB_NAME`: Job name for builds (e.g., `CICD-STD/build-by-dockerfile`)

## Architecture Overview

### Data Models (Prisma Schema)

The system manages these core entities:

1. **Project** - Top-level container for services and requirements
2. **Service** - Three types of services:
   - `application`: Custom applications (Git + Docker build)
   - `database`: Managed databases (MySQL, Redis, etc.)
   - `image`: Pre-built Docker images
3. **ServiceImage** - Built/versioned container images for services
4. **Deployment** - Deployment records tracking service rollouts
5. **Requirement** - Business requirements linked to services and AI tasks
6. **RequirementTaskLink** - AI employee task assignments
7. **SystemConfig** - Key-value system configuration storage

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── k8s/          # K8s operations (health, namespaces, services)
│   │   ├── projects/      # Project CRUD
│   │   ├── services/      # Service management
│   │   ├── requirements/  # Requirements management
│   │   └── health/        # Health check endpoint
│   ├── projects/          # Project pages & components
│   ├── requirements/      # Requirements pages
│   └── ai/               # AI employee management
├── lib/                   # Core utilities
│   ├── prisma.ts         # Prisma client singleton
│   ├── k8s.ts            # K8s client & operations (11k+ lines)
│   ├── jenkins.ts        # Jenkins CI/CD integration
│   ├── gitlab.ts         # GitLab API client
│   ├── system-config.ts  # System config utilities
│   └── volume-templates.ts # K8s volume templates
├── service/               # Business logic layer
│   ├── serviceSvc.ts     # Service management
│   ├── projectSvc.ts     # Project management
│   ├── requirementService.ts
│   └── aiMockStore.ts    # AI employee mock data
├── types/                 # TypeScript type definitions
│   ├── project.ts        # Service & project types
│   ├── k8s.ts            # K8s-related types
│   └── requirement.ts    # Requirement types
└── components/            # Reusable React components
```

### K8s Integration Architecture

The `K8sService` class (`src/lib/k8s.ts`) is the central abstraction:

- **Initialization**: Supports 3 auth methods (kubeconfig file, env var, token-based)
- **HTTPS Agent**: Auto-configures to skip TLS verification for self-signed certs
- **Resource Management**: CRUD operations for Deployments, Services, ConfigMaps, Secrets, Ingress, PVCs
- **Advanced Features**: 
  - File operations inside pods (list, read, write, mkdir)
  - Pod exec for remote commands
  - Service import from existing K8s workloads
  - RBAC permission checking with caching

### Service Deployment Flow

1. User creates a service via UI (type: application/database/image)
2. For applications:
   - Git repo cloned by Jenkins
   - Docker image built using provided Dockerfile
   - `ServiceImage` record created with build logs
3. Service deployed to K8s:
   - Deployment/StatefulSet created
   - Service (ClusterIP/NodePort) created
   - ConfigMaps/Secrets for env vars
   - PVC for persistent volumes (databases)
   - Optional Ingress for external access
4. `Deployment` record tracks deployment status

### API Patterns

All API routes follow Next.js 13+ conventions:
- `route.ts` exports `GET`, `POST`, `PUT`, `DELETE` handlers
- Use `NextRequest`/`NextResponse` for request/response handling
- Dynamic routes use `[param]` folder naming
- Error responses use consistent format: `{ error: string }`

## Important Patterns & Conventions

### Prisma Client Usage

Always use the singleton instance from `src/lib/prisma.ts`:

```typescript
import { prisma } from '@/lib/prisma'

// Prevents hot-reload connection exhaustion in development
```

### K8s Client Usage

```typescript
import { k8sService } from '@/lib/k8s'

// All K8s operations go through this singleton
// Includes built-in error handling and logging
```

### Type Safety

- All service types discriminated by `type` field (application/database/image)
- Use type guards to narrow union types before accessing type-specific fields
- Prisma Json fields (env_vars, resource_limits, volumes, network_config) require runtime validation

### Volume Handling

Database services automatically create PVCs using templates from `src/lib/volume-templates.ts`. The system uses:
- StatefulSets for databases (stable network identity)
- volumeClaimTemplates for automatic PVC provisioning
- Predefined data paths per database type (MySQL: `/var/lib/mysql`, Redis: `/data`)

## Testing & Debugging

```bash
# Health check endpoint
curl http://localhost:3000/api/health

# K8s connection diagnostic
curl http://localhost:3000/api/k8s/health

# Check K8s client initialization logs
# Look for "[K8s]" prefixed console output in server logs

# Prisma query logging (development only)
# Automatically enabled in dev mode via prisma.ts

# View build logs for a service
# Access via ServiceImage.build_logs or Deployment.build_logs
```

## Build Configuration Notes

- **Standalone Output**: `output: 'standalone'` in next.config.ts for Docker deployments
- **Prisma Binary Targets**: Includes `linux-musl-openssl-3.0.x` for Alpine-based containers
- **Type Checking**: Disabled during builds (`ignoreBuildErrors: true`) for faster Docker builds
  - Run `npx tsc --noEmit` locally to catch type errors before committing

## Common Gotchas

1. **K8s Auth Errors**: Check `[K8s]` logs on startup. If config fails to load, all K8s operations will fail silently.

2. **Prisma Generate**: If you see "Cannot find module '@prisma/client'", run `npx prisma generate` manually.

3. **Network Config Complexity**: The `network_config` JSON field has evolved through multiple versions (v1/v2). Always use `NormalizedNetworkConfig` internally.

4. **StatefulSet vs Deployment**: Database services use StatefulSets (for stable identity), applications use Deployments.

5. **Image Tag Updates**: When building via Jenkins, ensure `ServiceImage.is_active` is properly toggled to track the active image version.

6. **Environment Variables in K8s**: Stored as ConfigMaps for non-sensitive data, Secrets for sensitive data. Both mounted into pods.
