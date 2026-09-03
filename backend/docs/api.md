# API Contract

## Response shape

Every JSON response uses:

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "requestId": "uuid-or-client-request-id"
}
```

## Health check

`GET /api/v1/health`

The endpoint reports service process status and explicitly reports unconfigured dependencies. It is not a database readiness check yet.

## Not found

Unknown routes return HTTP 404 and application code `40401`.

## Authentication

### Web login

`POST /api/v1/auth/web/login`

Request body:

```json
{
  "username": "admin_demo",
  "password": "Admin123!"
}
```

The response contains a temporary bearer token and a public user object. Demo user records are persisted in `data/users.json` for local development; this is not the cloud users collection or a production identity service.

### Current user

`GET /api/v1/auth/me`

Request header:

```text
Authorization: Bearer <token>
```

### Logout

`POST /api/v1/auth/logout`

The current in-memory token is revoked.

### Mini-program login

`POST /api/v1/auth/mini-program/login`

This endpoint is reserved for the WeChat Cloud Development identity flow. It returns `50301` until a real cloud environment and provider validation are configured. The local service deliberately does not accept an arbitrary `openId` as proof of identity.

### Role smoke test

`GET /api/v1/system/admin-check`

Requires the `system:admin` permission. It exists only to verify RBAC before business endpoints are added.

### File upload

`POST /api/v1/files`

Requires `file:upload`. The assignment implementation accepts JSON with base64 content:

```json
{
  "originalName": "scale.png",
  "mimeType": "image/png",
  "relatedType": "scale_config",
  "relatedId": "scd-q9-v1",
  "contentBase64": "<base64-content>"
}
```

Allowed file types are PDF, JPEG, PNG, WebP, and XLSX. The local development limit is 20 MiB.
The response returns a `fileId` and a storage key. Local files are written under `data/files`.

### File list and metadata

`GET /api/v1/files?relatedType=assessment&relatedId=<id>`

Requires `file:read` and returns file metadata only.

`GET /api/v1/files/<fileId>`

Requires `file:read` and returns file metadata.

`GET /api/v1/files/<fileId>/download`

Requires `file:read` and returns the binary file. This download response is not JSON.

The local file adapter reports `mode: local_file` from the health endpoint. A
cloud storage adapter still needs the team's bucket configuration.
