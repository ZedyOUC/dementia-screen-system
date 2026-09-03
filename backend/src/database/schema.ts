export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "datetime"
  | "enum"
  | "object"
  | "array";

export type FieldDefinition = {
  type: FieldType;
  required?: boolean;
  nullable?: boolean;
  sensitive?: boolean;
  description: string;
  enumValues?: readonly string[];
};

export type IndexDefinition = {
  fields: readonly string[];
  unique?: boolean;
  description: string;
};

export type CollectionDefinition = {
  name: string;
  purpose: string;
  sourceBoundary: string;
  fields: Record<string, FieldDefinition>;
  indexes: readonly IndexDefinition[];
};

const auditFields: Record<string, FieldDefinition> = {
  createdAt: {
    type: "datetime",
    required: true,
    description: "Record creation time in ISO 8601 format.",
  },
  updatedAt: {
    type: "datetime",
    required: true,
    description: "Record last update time in ISO 8601 format.",
  },
};

export const SCHEMA_VERSION = "2026-09-02";

export const CORE_COLLECTION_NAMES = [
  "users",
  "patients",
  "scale_configs",
  "assessment_records",
  "assessment_answers",
] as const;

export const EXTENSION_COLLECTION_NAMES = ["files", "operation_logs"] as const;

export const COLLECTIONS: readonly CollectionDefinition[] = [
  {
    name: "users",
    purpose: "Web and mini-program identities used for authentication and authorization.",
    sourceBoundary: "Project task allocation: user table; not a clinical scale source.",
    fields: {
      userId: {
        type: "string",
        required: true,
        description: "Stable application user identifier.",
      },
      authProvider: {
        type: "enum",
        required: true,
        description: "Login channel used to create the identity.",
        enumValues: ["web", "mini_program", "seed"],
      },
      openId: {
        type: "string",
        nullable: true,
        sensitive: true,
        description: "Mini-program provider identifier when available.",
      },
      username: {
        type: "string",
        nullable: true,
        description: "Web login name when available.",
      },
      passwordHash: {
        type: "string",
        nullable: true,
        sensitive: true,
        description: "Password hash; plaintext passwords must never be stored.",
      },
      displayName: {
        type: "string",
        required: true,
        description: "Name shown in the administration interface.",
      },
      roleCodes: {
        type: "array",
        required: true,
        description: "Role codes such as admin, researcher, or evaluator.",
      },
      status: {
        type: "enum",
        required: true,
        description: "Whether this account can authenticate.",
        enumValues: ["active", "disabled", "pending"],
      },
      lastLoginAt: {
        type: "datetime",
        nullable: true,
        description: "Most recent successful login time.",
      },
      ...auditFields,
    },
    indexes: [
      {
        fields: ["userId"],
        unique: true,
        description: "Stable identity lookup.",
      },
      {
        fields: ["username"],
        unique: true,
        description: "Unique web login name when present.",
      },
      {
        fields: ["openId"],
        unique: true,
        description: "Unique mini-program identity when present.",
      },
    ],
  },
  {
    name: "patients",
    purpose: "Research participant profile and baseline information.",
    sourceBoundary:
      "Main baseline scale A-C and study record header in 1_AD临床前期SCD筛查量表-基线期-加上情景选择题.pdf.",
    fields: {
      patientId: {
        type: "string",
        required: true,
        description: "Stable application participant identifier.",
      },
      patientCode: {
        type: "string",
        required: true,
        description: "Research code shown to operators and reports.",
      },
      name: {
        type: "string",
        required: true,
        sensitive: true,
        description: "Participant name; access must be role-controlled.",
      },
      idNumberCiphertext: {
        type: "string",
        nullable: true,
        sensitive: true,
        description: "Encrypted national ID when collected; do not store plaintext.",
      },
      phoneCiphertext: {
        type: "string",
        nullable: true,
        sensitive: true,
        description: "Encrypted phone number when collected.",
      },
      gender: {
        type: "enum",
        nullable: true,
        description: "Source field A1.",
        enumValues: ["male", "female", "unknown"],
      },
      birthDate: {
        type: "string",
        nullable: true,
        description: "Source field A3, stored as YYYY-MM-DD.",
      },
      educationYears: {
        type: "number",
        nullable: true,
        description: "Source field A6; used by some supplied cutoff rules.",
      },
      profile: {
        type: "object",
        required: true,
        description:
          "Versioned structured profile for occupation, marriage, social support, medical history, and personal history.",
      },
      status: {
        type: "enum",
        required: true,
        description: "Participant record lifecycle state.",
        enumValues: ["active", "archived"],
      },
      ...auditFields,
    },
    indexes: [
      {
        fields: ["patientId"],
        unique: true,
        description: "Stable participant lookup.",
      },
      {
        fields: ["patientCode"],
        unique: true,
        description: "Research code must not be duplicated.",
      },
      {
        fields: ["name"],
        description: "Administrative search; access must be restricted.",
      },
    ],
  },
  {
    name: "scale_configs",
    purpose: "Versioned question, option, instruction, stimulus, and scoring metadata.",
    sourceBoundary:
      "Main baseline scale plus operation instructions, CDR, and ADAS-Cog supplied PDFs. Clinical rules remain subject to clinician confirmation.",
    fields: {
      scaleConfigId: {
        type: "string",
        required: true,
        description: "Stable configuration identifier.",
      },
      scaleCode: {
        type: "string",
        required: true,
        description:
          "Machine-readable code, for example SCD_Q9, MOCA_B, CDR, or ADAS_COG.",
      },
      name: {
        type: "string",
        required: true,
        description: "Display name of the scale.",
      },
      version: {
        type: "string",
        required: true,
        description: "Immutable configuration version.",
      },
      category: {
        type: "enum",
        required: true,
        description: "Broad scale category.",
        enumValues: ["screening", "cognitive", "mood", "sleep", "function", "biomarker"],
      },
      sourceDocument: {
        type: "string",
        required: true,
        description: "Supplied document filename used as the source reference.",
      },
      instructions: {
        type: "array",
        required: true,
        description: "Ordered administration instructions.",
      },
      items: {
        type: "array",
        required: true,
        description: "Ordered item definitions and option metadata.",
      },
      scoring: {
        type: "object",
        required: true,
        description:
          "Scoring algorithm reference and thresholds; actual calculation belongs to the scoring-engine task.",
      },
      stimulusAssets: {
        type: "array",
        required: true,
        description: "IDs or storage keys for BNT, MoCA-B, STT, and related visual materials.",
      },
      status: {
        type: "enum",
        required: true,
        description: "Whether this version may be used for new assessments.",
        enumValues: ["draft", "active", "retired"],
      },
      ...auditFields,
    },
    indexes: [
      {
        fields: ["scaleCode", "version"],
        unique: true,
        description: "One immutable definition per scale version.",
      },
      {
        fields: ["status"],
        description: "Find active configurations.",
      },
    ],
  },
  {
    name: "assessment_records",
    purpose: "One measurement session for one participant and one scale version.",
    sourceBoundary:
      "Main scale result fields, CDR result fields, and ADAS-Cog result fields from supplied documents.",
    fields: {
      assessmentId: {
        type: "string",
        required: true,
        description: "Stable measurement session identifier.",
      },
      patientId: {
        type: "string",
        required: true,
        description: "Reference to patients.patientId.",
      },
      scaleCode: {
        type: "string",
        required: true,
        description: "Reference to the administered scale.",
      },
      scaleVersion: {
        type: "string",
        required: true,
        description: "Exact scale configuration version used.",
      },
      assessorId: {
        type: "string",
        required: true,
        description: "Reference to users.userId.",
      },
      informantId: {
        type: "string",
        nullable: true,
        description: "Optional informant reference for informant-completed sections.",
      },
      status: {
        type: "enum",
        required: true,
        description: "Measurement lifecycle state.",
        enumValues: ["draft", "in_progress", "submitted", "reviewed", "void"],
      },
      startedAt: {
        type: "datetime",
        nullable: true,
        description: "Assessment start time.",
      },
      submittedAt: {
        type: "datetime",
        nullable: true,
        description: "Assessment submission time.",
      },
      durationSeconds: {
        type: "number",
        nullable: true,
        description: "Elapsed assessment duration when measurable.",
      },
      scoreSummary: {
        type: "object",
        required: true,
        description:
          "Calculated score snapshot, including total, subscales, abnormal flags, and clinician review state.",
      },
      algorithmVersion: {
        type: "string",
        nullable: true,
        description: "Scoring-engine version used for scoreSummary.",
      },
      reviewerNote: {
        type: "string",
        nullable: true,
        description: "Human review note; no unverified medical conclusion should be generated here.",
      },
      ...auditFields,
    },
    indexes: [
      {
        fields: ["assessmentId"],
        unique: true,
        description: "Stable assessment lookup.",
      },
      {
        fields: ["patientId", "createdAt"],
        description: "Participant assessment history.",
      },
      {
        fields: ["assessorId", "status"],
        description: "Assessor work queue.",
      },
    ],
  },
  {
    name: "assessment_answers",
    purpose: "Original answers and process observations belonging to an assessment.",
    sourceBoundary:
      "All item-level fields in the supplied baseline scale, CDR, and ADAS-Cog forms; preserve raw observations before scoring.",
    fields: {
      answerId: {
        type: "string",
        required: true,
        description: "Stable answer record identifier.",
      },
      assessmentId: {
        type: "string",
        required: true,
        description: "Reference to assessment_records.assessmentId.",
      },
      itemCode: {
        type: "string",
        required: true,
        description: "Stable item or sub-item code within the scale version.",
      },
      value: {
        type: "object",
        required: true,
        description:
          "Typed answer payload; supports integer, decimal, text, option, boolean, and structured process data.",
      },
      answerStatus: {
        type: "enum",
        required: true,
        description: "Distinguishes unanswered from NA, unknown, refused, and answered.",
        enumValues: ["answered", "unanswered", "na", "unknown", "refused"],
      },
      observation: {
        type: "object",
        required: true,
        description:
          "Optional process data such as response time, prompt count, error count, drawing metadata, or informant source.",
      },
      recordedBy: {
        type: "string",
        required: true,
        description: "Reference to users.userId who recorded the answer.",
      },
      ...auditFields,
    },
    indexes: [
      {
        fields: ["answerId"],
        unique: true,
        description: "Stable answer lookup.",
      },
      {
        fields: ["assessmentId", "itemCode"],
        unique: true,
        description: "One current answer per item in an assessment.",
      },
    ],
  },
  {
    name: "files",
    purpose: "Metadata for scale assets, uploaded reports, and participant-related files.",
    sourceBoundary: "Project task allocation: file upload/download service; not a clinical score source.",
    fields: {
      fileId: {
        type: "string",
        required: true,
        description: "Stable file metadata identifier.",
      },
      originalName: {
        type: "string",
        required: true,
        description: "Original client filename.",
      },
      storageKey: {
        type: "string",
        required: true,
        sensitive: true,
        description: "Cloud storage object key.",
      },
      mimeType: {
        type: "string",
        required: true,
        description: "Validated MIME type.",
      },
      sizeBytes: {
        type: "number",
        required: true,
        description: "File size in bytes.",
      },
      relatedType: {
        type: "enum",
        required: true,
        description: "Resource to which the file belongs.",
        enumValues: ["scale_config", "assessment", "patient", "report"],
      },
      relatedId: {
        type: "string",
        required: true,
        description: "Identifier of the related resource.",
      },
      uploadedBy: {
        type: "string",
        required: true,
        description: "Reference to users.userId.",
      },
      ...auditFields,
    },
    indexes: [
      {
        fields: ["fileId"],
        unique: true,
        description: "Stable file lookup.",
      },
      {
        fields: ["relatedType", "relatedId"],
        description: "List files for a resource.",
      },
    ],
  },
  {
    name: "operation_logs",
    purpose: "Security and audit trail for sensitive data and administration actions.",
    sourceBoundary: "Project task allocation: operation log service; not a clinical score source.",
    fields: {
      logId: {
        type: "string",
        required: true,
        description: "Stable audit record identifier.",
      },
      userId: {
        type: "string",
        nullable: true,
        description: "Actor identifier when authenticated.",
      },
      action: {
        type: "string",
        required: true,
        description: "Machine-readable operation name.",
      },
      resourceType: {
        type: "string",
        required: true,
        description: "Affected resource category.",
      },
      resourceId: {
        type: "string",
        nullable: true,
        description: "Affected resource identifier.",
      },
      requestId: {
        type: "string",
        required: true,
        description: "Request correlation identifier.",
      },
      metadata: {
        type: "object",
        required: true,
        description: "Non-sensitive audit metadata; never store passwords or raw ID numbers.",
      },
      ...auditFields,
    },
    indexes: [
      {
        fields: ["logId"],
        unique: true,
        description: "Stable audit lookup.",
      },
      {
        fields: ["userId", "createdAt"],
        description: "Actor audit history.",
      },
      {
        fields: ["resourceType", "resourceId", "createdAt"],
        description: "Resource audit history.",
      },
    ],
  },
] as const;

export function getCollection(name: string): CollectionDefinition | undefined {
  return COLLECTIONS.find((collection) => collection.name === name);
}
