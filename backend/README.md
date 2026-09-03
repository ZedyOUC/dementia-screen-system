# AD SCD Backend

This directory contains the backend foundation for the AD preclinical SCD screening project.

## Current scope

- TypeScript service skeleton
- Unified JSON response shape
- Request ID propagation through `X-Request-Id`
- Health check endpoint
- CORS response headers for local frontend integration
- Versioned database schema with five core collections and two service extensions
- Local persistent user store for development
- Explicit local-only/not-connected status for database and object storage
- PostgreSQL migration for the assignment database

## Local run

```text
npm install
npm run typecheck
npm run db:validate
npm run start
```

The health endpoint is:

```text
GET http://localhost:3000/api/v1/health
```

The database schema is defined in `src/database/schema.ts`. `npm run db:validate` checks collection names, fields, enum definitions, and indexes.

On first start, the development auth layer creates `data/users.json` with three demo accounts. This is a local persistence adapter, not the cloud database.

The local service does not claim that a cloud database, cloud storage bucket, authentication service, or cloud function has been configured. The health endpoint reports the schema version and collection count separately from connection status.

For the PostgreSQL assignment workflow, see `docs/postgres-assignment-runbook.md` and
`docs/task2-collaboration.md`.

For cloud-function deployment and the minimum operations checklist, see
`docs/deployment-ops.md`. The dependency-free smoke-test function is under
`cloud-functions/ad-scd-health`.

Task-package 1 scale data has been converted for PostgreSQL under
`fixtures/task1-scale-configs.json` and `sql/004_seed_scale_configs.sql`.
See `docs/task1-conversion.md` before importing it.
