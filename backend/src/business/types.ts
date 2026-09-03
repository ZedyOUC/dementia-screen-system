export type Patient = {
  patientId: string;
  patientCode: string;
  name: string;
  idNumberCiphertext: string | null;
  phoneCiphertext: string | null;
  gender: "male" | "female" | "unknown" | null;
  birthDate: string | null;
  educationYears: number | null;
  profile: Record<string, unknown>;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type AssessmentAnswer = {
  answerId: string;
  assessmentId: string;
  itemCode: string;
  optionCode: string | null;
  value: Record<string, unknown>;
  answerStatus: "answered" | "unanswered" | "na" | "unknown" | "refused";
  observation: Record<string, unknown>;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ScoreSummary = {
  totalScore: number | null;
  maximumScore: number | null;
  resultLabel: string | null;
  isAbnormal: boolean | null;
  scoringStatus: "calculated" | "pending_task1_engine";
  scoringMethod: string;
  warning: string | null;
};

export type Assessment = {
  assessmentId: string;
  patientId: string;
  scaleCode: string;
  scaleVersion: string;
  assessorId: string;
  informantId: string | null;
  status: "draft" | "in_progress" | "submitted" | "reviewed" | "void";
  startedAt: string | null;
  submittedAt: string | null;
  durationSeconds: number | null;
  scoreSummary: ScoreSummary;
  algorithmVersion: string | null;
  reviewerNote: string | null;
  answers: AssessmentAnswer[];
  createdAt: string;
  updatedAt: string;
};

export type OperationLog = {
  logId: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  requestId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BusinessData = {
  patients: Patient[];
  assessments: Assessment[];
  operationLogs: OperationLog[];
};
