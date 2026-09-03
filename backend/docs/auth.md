# Authentication and Authorization

## Current implementation

- Passwords are hashed with Node.js `scryptSync` and a per-user random salt.
- Web login issues a random opaque bearer token.
- User records are persisted to `data/users.json` in development.
- Tokens are still stored in memory and expire after `AUTH_TOKEN_TTL_SECONDS` (default 7200 seconds).
- `/api/v1/auth/me` validates the token and returns only public user fields.
- `/api/v1/auth/logout` revokes the token.
- Role permissions are defined in `src/auth/auth.ts`.
- The seeded local accounts are `admin_demo`, `researcher_demo`, and `evaluator_demo`.

## Demo credentials

These credentials are for local testing only:

| Username | Password | Role |
|---|---|---|
| `admin_demo` | `Admin123!` | admin |
| `researcher_demo` | `Researcher123!` | researcher |
| `evaluator_demo` | `Evaluator123!` | evaluator |

Do not use these accounts in a deployed environment.

## Important limitation

The current token store is process memory. Restarting the service invalidates all tokens, and multiple service instances do not share sessions. Before deployment, replace the demo user/session store with the cloud database or the selected cloud identity service.

The mini-program endpoint intentionally returns `50301` because no cloud environment ID or provider validation configuration has been supplied. Accepting a client-supplied `openId` would not be an authenticated login.

## Permission policy

```text
admin:
  system:admin and all listed permissions

researcher:
  patient:read
  assessment:read
  assessment:create
  assessment:update
  scale:read
  file:read
  file:upload

evaluator:
  patient:read
  assessment:read
  assessment:create
  assessment:update
  file:read
  file:upload
```

These are project implementation defaults, not clinical rules from the supplied PDFs.
