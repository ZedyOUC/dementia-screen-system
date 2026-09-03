# Database Design

## Source and boundary

The five core collections follow the project task allocation:

1. `users`
2. `patients`
3. `scale_configs`
4. `assessment_records`
5. `assessment_answers`

The backend foundation also reserves two service collections:

6. `files`
7. `operation_logs`

The clinical source material is used to identify fields and raw observations. It does not authorize the backend to invent new diagnostic thresholds. Scoring formulas belong to the scoring-engine task and must be stored with an algorithm version.

## Important modeling decisions

- `assessment_records` stores one measurement session.
- `assessment_answers` stores item-level raw answers and process observations.
- Raw answers and calculated scores are deliberately separate.
- `answerStatus` supports `na`, `unknown`, and `refused`; these values must not be silently converted to zero.
- The `value` object supports decimal values such as the `0.5` option used by SCD-Q9.
- `scale_configs` is versioned so that an old assessment can always be interpreted using the definition that was actually administered.
- CDR requires six domain values plus `global_cdr` and `cdr_sb` in the score snapshot; these are score-engine outputs, not patient profile fields.
- Files are represented by metadata and a cloud storage key. Raw local paths are not part of the data contract.
- Sensitive identifiers are represented as encrypted fields in the application model. Encryption and key management are not implemented yet.

## Relationships

```text
users 1 ─── * assessment_records
patients 1 ─── * assessment_records
scale_configs 1 ─── * assessment_records
assessment_records 1 ─── * assessment_answers
patients 1 ─── * files
assessment_records 1 ─── * files
users 1 ─── * operation_logs
```

These are application-level references. The schema is deliberately compatible with a document database; actual cloud collection creation and security rules still require a configured WeChat Cloud Development environment.

## Local validation

```text
npm run db:validate
```

Expected output:

```text
Database schema 7 collections validated.
Core collections: users, patients, scale_configs, assessment_records, assessment_answers
Extensions: files, operation_logs
```

## Not completed yet

- Cloud environment ID `ad-scd-dev-d1g1y08v5962945fd` has been supplied, but it has not been verified from this workspace.
- No cloud database connection has been established.
- No cloud security rules have been deployed.
- No real participant data has been inserted.
- Development users are persisted in `data/users.json`; this file is ignored by git and is not a substitute for the cloud database.

## PostgreSQL implementation

The PostgreSQL migration is in `sql/001_init.sql`. It creates relational tables corresponding to the seven logical collections above. JSON-shaped fields such as `profile`, `items`, `scoring`, `value`, and `metadata` use PostgreSQL `JSONB` so the existing versioned application model remains intact.
