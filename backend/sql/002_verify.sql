-- Run after 001_init.sql.
-- Expected result: seven rows, one for each application table.

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users',
    'patients',
    'scale_configs',
    'assessment_records',
    'assessment_answers',
    'files',
    'operation_logs'
  )
ORDER BY table_name;
