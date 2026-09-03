# Task 3 Business API

This document is the handoff contract for the Web administration frontend and the mini-program frontend. All JSON endpoints use the common response envelope documented in `api.md` and require `Authorization: Bearer <token>` unless stated otherwise.

## Run and verify

```text
npm ci
npm run typecheck
npm run db:validate
npm test
npm start
```

Local data is persisted in `data/business.json` and `data/users.json`. Set `LOCAL_DATA_DIR` to move these files. The adapters intentionally remain replaceable because task 2 has not connected the real cloud database yet.

## Endpoint summary

| Module | Method and path | Permission | Purpose |
| --- | --- | --- | --- |
| Scale | `GET /api/v1/scales` | `scale:read` | List the six task-1 scale configurations |
| Scale | `GET /api/v1/scales/{scaleCode}` | `scale:read` | Get questions, options and scoring metadata |
| Patient | `GET /api/v1/patients` | `patient:read` | Paginated multi-condition search |
| Patient | `POST /api/v1/patients` | `patient:create` | Create a patient |
| Patient | `GET /api/v1/patients/{patientId}` | `patient:read` | Patient details |
| Patient | `PUT/PATCH /api/v1/patients/{patientId}` | `patient:update` | Update a patient |
| Patient | `DELETE /api/v1/patients/{patientId}` | `patient:delete` | Delete a patient with no assessments |
| Assessment | `POST /api/v1/assessments` | `assessment:create` | Save answers and submit an assessment |
| Assessment | `GET /api/v1/assessments` | `assessment:read` | Paginated assessment search |
| Assessment | `GET /api/v1/assessments/{assessmentId}` | `assessment:read` | Assessment, answers and patient details |
| Statistics | `GET /api/v1/statistics/overview` | `assessment:read` | Dashboard totals and abnormal ratio |
| Statistics | `GET /api/v1/statistics/score-distribution` | `assessment:read` | ECharts-ready score/count array |
| Report | `GET /api/v1/reports/assessments/{assessmentId}.pdf` | `report:export` | Single PDF report |
| Report | `GET /api/v1/reports/assessments.xls` | `report:export` | Filtered Excel-compatible batch export |
| Account | `GET /api/v1/system/accounts` | `system:admin` | Account list without password hashes |
| Account | `POST /api/v1/system/accounts` | `system:admin` | Create a Web account |
| Account | `PATCH /api/v1/system/accounts/{userId}` | `system:admin` | Update display name, roles or status |
| Account | `PUT /api/v1/system/password` | authenticated | Change the current user's password |
| Audit | `GET /api/v1/system/operation-logs` | `operation_log:read` | Search operation logs |

## Patients

List query parameters: `page`, `pageSize` (maximum 200), `keyword` (matches patient code or name), `gender`, and `status`.

Create example:

```json
{
  "patientCode": "SCD-2026-001",
  "name": "示例患者",
  "gender": "female",
  "birthDate": "1958-06-01",
  "educationYears": 9,
  "idNumberCiphertext": null,
  "phoneCiphertext": null,
  "profile": {
    "occupation": "retired",
    "source": "outpatient"
  }
}
```

Do not send plaintext identity-card or phone values in the ciphertext fields. Production encryption belongs in the task-2 database adapter. Deletion is rejected when assessment records refer to a patient; update `status` to `archived` instead.

## Assessments and scoring boundary

Create/submit example:

```json
{
  "patientId": "patient-uuid",
  "scaleCode": "SCD_Q9",
  "scaleVersion": "1.0",
  "status": "submitted",
  "durationSeconds": 180,
  "answers": [
    {
      "itemCode": "SCD_Q9_01",
      "optionCode": "否",
      "answerStatus": "answered",
      "value": {},
      "observation": {}
    }
  ]
}
```

For `submitted` records, required items and option codes are validated against `fixtures/task1-scale-configs.json`. `SUM` and `ITEMIZED` configurations are calculated only from option scores supplied by task 1; education-dependent cutoffs also use task-1 metadata. No clinical thresholds are invented here.

CDR's overall score requires the complex task-1 algorithm that has not been uploaded. CDR answers are still saved, but `scoreSummary.scoringStatus` is `pending_task1_engine`, its total/result are `null`, and a warning is returned. After task 1 publishes its callable scoring module, replace the CDR branch in `src/business/scoring.ts`; no frontend contract needs to change.

Assessment list query parameters: `page`, `pageSize`, `patientId`, `scaleCode`, `status`, `from`, and `to`. Dates are ISO 8601 strings.

## Statistics

`GET /statistics/overview` returns:

```json
{
  "patientTotal": 12,
  "activePatientTotal": 11,
  "assessmentTotal": 30,
  "submittedAssessmentTotal": 28,
  "scoredAssessmentTotal": 27,
  "abnormalTotal": 8,
  "abnormalRatio": 0.2963
}
```

The abnormal ratio denominator contains only assessments whose task-1 configuration produced a non-null abnormal result. Pending CDR results therefore do not distort the dashboard.

`GET /statistics/score-distribution?scaleCode=MMSE` returns `distribution: [{ "score": 18, "count": 2 }]` sorted by score.

## Reports

PDF output is generated without an external service and uses the PDF standard Chinese font name `STSong-Light`. The report contains a screening-only disclaimer.

The batch endpoint returns SpreadsheetML with the `.xls` extension and `application/vnd.ms-excel`; it opens directly in Microsoft Excel and preserves Chinese text. It accepts the same filtering parameters as the assessment list. If the final acceptance rubric strictly requires `.xlsx`, replace `createAssessmentsExcel` with the team's approved XLSX library after dependencies are agreed.

## Accounts and audit logs

Create-account fields are `username`, `password` (minimum eight characters), `displayName`, `roleCodes`, and optional `status`. Allowed roles are `admin`, `researcher`, and `evaluator`. Password hashes never appear in API responses.

Password change body:

```json
{
  "currentPassword": "old password",
  "newPassword": "new password"
}
```

All sessions for the user are revoked after a password change. Operation logs are written for patient changes, assessment submission, report exports, account changes, and password changes. Log queries support `page`, `pageSize`, `action`, and `userId`.

## Remaining integration work

1. Task 1: connect the final callable scoring engine, especially CDR, then add golden clinical scoring cases.
2. Task 2: replace `LocalBusinessStore` with the real cloud/PostgreSQL adapter and deploy the service/cloud functions.
3. Frontends: use this document as the stable endpoint contract; only base URL and authentication provider should change during cloud integration.
