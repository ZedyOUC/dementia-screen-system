import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  AuthError,
  ROLE_CODES,
  authenticateToken,
  changePassword,
  createManagedUser,
  getBearerToken,
  listManagedUsers,
  requirePermission,
  updateManagedUser,
  type AuthUser,
  type RoleCode,
} from "../auth/auth.js";
import { LocalBusinessStore } from "./business-store.js";
import { createAssessmentPdf, createAssessmentsExcel } from "./exports.js";
import {
  calculateScore,
  findScaleConfig,
  listScaleConfigs,
  type SubmittedAnswer,
} from "./scoring.js";
import type { Assessment, Patient, ScoreSummary } from "./types.js";

export type SendJson = (
  response: ServerResponse,
  statusCode: number,
  payload: { code: number; message: string; data: unknown },
  requestId: string,
) => void;

export type ReadJsonBody = (request: IncomingMessage, maxBytes?: number) => Promise<unknown>;

export type BusinessRouteContext = {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  method: string;
  requestId: string;
  apiPrefix: string;
  sendJson: SendJson;
  readJsonBody: ReadJsonBody;
};

const businessStore = new LocalBusinessStore();

function objectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AuthError(400, 40001, "request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

function stringField(
  body: Record<string, unknown>,
  field: string,
  options: { required?: boolean; nullable?: boolean } = {},
): string | null | undefined {
  const value = body[field];
  if (value === undefined) {
    if (options.required) throw new AuthError(400, 40001, `${field} is required`);
    return undefined;
  }
  if (value === null && options.nullable) return null;
  if (typeof value !== "string" || value.trim() === "") {
    throw new AuthError(400, 40001, `${field} must be a non-empty string`);
  }
  return value.trim();
}

function numberField(body: Record<string, unknown>, field: string): number | null | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AuthError(400, 40001, `${field} must be a number`);
  }
  return value;
}

function enumField<T extends string>(
  body: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
  options: { required?: boolean; nullable?: boolean } = {},
): T | null | undefined {
  const value = stringField(body, field, options);
  if (value === undefined || value === null) return value;
  if (!allowed.includes(value as T)) throw new AuthError(400, 40001, `${field} is invalid`);
  return value as T;
}

function authenticate(request: IncomingMessage): AuthUser {
  return authenticateToken(getBearerToken(request.headers.authorization));
}

function pagination(url: URL): { page: number; pageSize: number } {
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
    throw new AuthError(400, 40001, "page/pageSize is invalid (pageSize max: 200)");
  }
  return { page, pageSize };
}

function paged<T>(items: T[], page: number, pageSize: number): {
  items: T[]; page: number; pageSize: number; total: number;
} {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length };
}

function patientInput(body: Record<string, unknown>, existing?: Patient): Patient {
  const timestamp = new Date().toISOString();
  const patientCode = stringField(body, "patientCode", { required: !existing }) ?? existing?.patientCode;
  const name = stringField(body, "name", { required: !existing }) ?? existing?.name;
  if (!patientCode || !name) throw new AuthError(400, 40001, "patientCode and name are required");
  const educationYears = numberField(body, "educationYears");
  if (educationYears !== undefined && educationYears !== null && (educationYears < 0 || educationYears > 40)) {
    throw new AuthError(400, 40001, "educationYears must be between 0 and 40");
  }
  const profile = body.profile;
  if (profile !== undefined && (typeof profile !== "object" || profile === null || Array.isArray(profile))) {
    throw new AuthError(400, 40001, "profile must be an object");
  }
  return {
    patientId: existing?.patientId ?? randomUUID(),
    patientCode,
    name,
    idNumberCiphertext:
      stringField(body, "idNumberCiphertext", { nullable: true }) ?? existing?.idNumberCiphertext ?? null,
    phoneCiphertext:
      stringField(body, "phoneCiphertext", { nullable: true }) ?? existing?.phoneCiphertext ?? null,
    gender:
      enumField(body, "gender", ["male", "female", "unknown"] as const, { nullable: true }) ??
      existing?.gender ?? null,
    birthDate: stringField(body, "birthDate", { nullable: true }) ?? existing?.birthDate ?? null,
    educationYears: educationYears ?? existing?.educationYears ?? null,
    profile: (profile as Record<string, unknown> | undefined) ?? existing?.profile ?? {},
    status:
      enumField(body, "status", ["active", "archived"] as const) ?? existing?.status ?? "active",
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function addLog(
  user: AuthUser,
  requestId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata: Record<string, unknown> = {},
): void {
  businessStore.addLog({ userId: user.userId, action, resourceType, resourceId, requestId, metadata });
}

function assessmentAnswers(body: Record<string, unknown>): SubmittedAnswer[] {
  if (!Array.isArray(body.answers)) throw new AuthError(400, 40001, "answers must be an array");
  const answers = body.answers.map((raw, index) => {
    const answer = objectBody(raw);
    const itemCode = stringField(answer, "itemCode", { required: true });
    const optionCode = stringField(answer, "optionCode", { nullable: true });
    const answerStatus = enumField(
      answer,
      "answerStatus",
      ["answered", "unanswered", "na", "unknown", "refused"] as const,
    );
    const value = answer.value;
    const observation = answer.observation;
    if (value !== undefined && (typeof value !== "object" || value === null || Array.isArray(value))) {
      throw new AuthError(400, 40001, `answers[${index}].value must be an object`);
    }
    if (observation !== undefined && (typeof observation !== "object" || observation === null || Array.isArray(observation))) {
      throw new AuthError(400, 40001, `answers[${index}].observation must be an object`);
    }
    return {
      itemCode: itemCode!,
      optionCode,
      answerStatus: answerStatus ?? "answered",
      value: (value as Record<string, unknown> | undefined) ?? {},
      observation: (observation as Record<string, unknown> | undefined) ?? {},
    } satisfies SubmittedAnswer;
  });
  if (new Set(answers.map((item) => item.itemCode)).size !== answers.length) {
    throw new AuthError(400, 40001, "answers contains duplicate itemCode values");
  }
  return answers;
}

function pendingScore(maximumScore: number, method: string): ScoreSummary {
  return {
    totalScore: null,
    maximumScore,
    resultLabel: null,
    isAbnormal: null,
    scoringStatus: "pending_task1_engine",
    scoringMethod: method,
    warning: "Draft/in-progress assessments are scored when submitted.",
  };
}

function filterAssessments(url: URL): Assessment[] {
  const patientId = url.searchParams.get("patientId");
  const scaleCode = url.searchParams.get("scaleCode");
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  return businessStore.listAssessments().filter((item) =>
    (!patientId || item.patientId === patientId) &&
    (!scaleCode || item.scaleCode === scaleCode) &&
    (!status || item.status === status) &&
    (!from || item.createdAt >= from) &&
    (!to || item.createdAt <= to)
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function handleBusinessRoute(context: BusinessRouteContext): Promise<boolean> {
  const { request, response, url, method, requestId, apiPrefix, sendJson, readJsonBody } = context;
  if (!url.pathname.startsWith(`${apiPrefix}/`)) return false;
  const path = url.pathname.slice(apiPrefix.length);

  if (method === "GET" && path === "/scales") {
    const user = authenticate(request);
    requirePermission(user, "scale:read");
    const scales = listScaleConfigs().map(({ items, ...config }) => ({ ...config, itemCount: items.length }));
    sendJson(response, 200, { code: 0, message: "ok", data: { scales } }, requestId);
    return true;
  }
  const scaleMatch = path.match(/^\/scales\/([^/]+)$/);
  if (method === "GET" && scaleMatch) {
    const user = authenticate(request);
    requirePermission(user, "scale:read");
    const scale = findScaleConfig(decodeURIComponent(scaleMatch[1]));
    if (!scale) throw new AuthError(404, 40401, "scale not found");
    sendJson(response, 200, { code: 0, message: "ok", data: { scale } }, requestId);
    return true;
  }

  if (path === "/patients" && method === "GET") {
    const user = authenticate(request);
    requirePermission(user, "patient:read");
    const { page, pageSize } = pagination(url);
    const keyword = (url.searchParams.get("keyword") ?? "").toLowerCase();
    const gender = url.searchParams.get("gender");
    const status = url.searchParams.get("status");
    const patients = businessStore.listPatients().filter((patient) =>
      (!keyword || patient.name.toLowerCase().includes(keyword) || patient.patientCode.toLowerCase().includes(keyword)) &&
      (!gender || patient.gender === gender) && (!status || patient.status === status)
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    sendJson(response, 200, { code: 0, message: "ok", data: paged(patients, page, pageSize) }, requestId);
    return true;
  }
  if (path === "/patients" && method === "POST") {
    const user = authenticate(request);
    requirePermission(user, "patient:create");
    const patient = patientInput(objectBody(await readJsonBody(request)));
    if (businessStore.findPatientByCode(patient.patientCode)) {
      throw new AuthError(409, 40901, "patientCode already exists");
    }
    businessStore.savePatient(patient);
    addLog(user, requestId, "patient.create", "patient", patient.patientId, { patientCode: patient.patientCode });
    sendJson(response, 201, { code: 0, message: "created", data: { patient } }, requestId);
    return true;
  }
  const patientMatch = path.match(/^\/patients\/([^/]+)$/);
  if (patientMatch) {
    const patientId = decodeURIComponent(patientMatch[1]);
    const patient = businessStore.findPatient(patientId);
    if (!patient) throw new AuthError(404, 40401, "patient not found");
    const user = authenticate(request);
    if (method === "GET") {
      requirePermission(user, "patient:read");
      sendJson(response, 200, { code: 0, message: "ok", data: { patient } }, requestId);
      return true;
    }
    if (method === "PUT" || method === "PATCH") {
      requirePermission(user, "patient:update");
      const updated = patientInput(objectBody(await readJsonBody(request)), patient);
      const duplicate = businessStore.findPatientByCode(updated.patientCode);
      if (duplicate && duplicate.patientId !== patient.patientId) {
        throw new AuthError(409, 40901, "patientCode already exists");
      }
      businessStore.savePatient(updated);
      addLog(user, requestId, "patient.update", "patient", patientId);
      sendJson(response, 200, { code: 0, message: "ok", data: { patient: updated } }, requestId);
      return true;
    }
    if (method === "DELETE") {
      requirePermission(user, "patient:delete");
      if (businessStore.listAssessments().some((item) => item.patientId === patientId)) {
        throw new AuthError(409, 40901, "patient has assessments; archive the patient instead");
      }
      businessStore.deletePatient(patientId);
      addLog(user, requestId, "patient.delete", "patient", patientId, { patientCode: patient.patientCode });
      sendJson(response, 200, { code: 0, message: "ok", data: null }, requestId);
      return true;
    }
  }

  if (path === "/assessments" && method === "POST") {
    const user = authenticate(request);
    requirePermission(user, "assessment:create");
    const body = objectBody(await readJsonBody(request));
    const patientId = stringField(body, "patientId", { required: true })!;
    const patient = businessStore.findPatient(patientId);
    if (!patient) throw new AuthError(404, 40401, "patient not found");
    const scaleCode = stringField(body, "scaleCode", { required: true })!;
    const scaleVersion = stringField(body, "scaleVersion") ?? undefined;
    const config = findScaleConfig(scaleCode, scaleVersion);
    if (!config) throw new AuthError(404, 40401, "scale configuration not found");
    const status = enumField(body, "status", ["draft", "in_progress", "submitted"] as const) ?? "submitted";
    const submitted = assessmentAnswers(body);
    const timestamp = new Date().toISOString();
    const assessmentId = randomUUID();
    const scoreSummary = status === "submitted"
      ? calculateScore(config, submitted, patient.educationYears)
      : pendingScore(config.scoring.scoreMax, config.scoring.algorithmSource);
    const assessment: Assessment = {
      assessmentId,
      patientId,
      scaleCode,
      scaleVersion: config.version,
      assessorId: user.userId,
      informantId: stringField(body, "informantId", { nullable: true }) ?? null,
      status,
      startedAt: stringField(body, "startedAt", { nullable: true }) ?? timestamp,
      submittedAt: status === "submitted" ? timestamp : null,
      durationSeconds: numberField(body, "durationSeconds") ?? null,
      scoreSummary,
      algorithmVersion: scoreSummary.scoringStatus === "calculated" ? config.version : null,
      reviewerNote: stringField(body, "reviewerNote", { nullable: true }) ?? null,
      answers: submitted.map((answer) => ({
        answerId: randomUUID(), assessmentId, itemCode: answer.itemCode,
        optionCode: answer.optionCode ?? null, value: answer.value ?? {},
        answerStatus: answer.answerStatus ?? "answered", observation: answer.observation ?? {},
        recordedBy: user.userId, createdAt: timestamp, updatedAt: timestamp,
      })),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    businessStore.saveAssessment(assessment);
    addLog(user, requestId, "assessment.create", "assessment", assessmentId, { scaleCode, status });
    sendJson(response, 201, { code: 0, message: "created", data: { assessment } }, requestId);
    return true;
  }
  if (path === "/assessments" && method === "GET") {
    const user = authenticate(request);
    requirePermission(user, "assessment:read");
    const { page, pageSize } = pagination(url);
    const records = filterAssessments(url).map(({ answers, ...assessment }) => ({ ...assessment, answerCount: answers.length }));
    sendJson(response, 200, { code: 0, message: "ok", data: paged(records, page, pageSize) }, requestId);
    return true;
  }
  const assessmentMatch = path.match(/^\/assessments\/([^/]+)$/);
  if (assessmentMatch && method === "GET") {
    const user = authenticate(request);
    requirePermission(user, "assessment:read");
    const assessment = businessStore.findAssessment(decodeURIComponent(assessmentMatch[1]));
    if (!assessment) throw new AuthError(404, 40401, "assessment not found");
    const patient = businessStore.findPatient(assessment.patientId) ?? null;
    sendJson(response, 200, { code: 0, message: "ok", data: { assessment, patient } }, requestId);
    return true;
  }

  if (path === "/statistics/overview" && method === "GET") {
    const user = authenticate(request);
    requirePermission(user, "assessment:read");
    const assessments = businessStore.listAssessments();
    const scored = assessments.filter((item) => item.scoreSummary.isAbnormal !== null);
    const abnormal = scored.filter((item) => item.scoreSummary.isAbnormal).length;
    sendJson(response, 200, { code: 0, message: "ok", data: {
      patientTotal: businessStore.listPatients().length,
      activePatientTotal: businessStore.listPatients().filter((item) => item.status === "active").length,
      assessmentTotal: assessments.length,
      submittedAssessmentTotal: assessments.filter((item) => item.status === "submitted").length,
      scoredAssessmentTotal: scored.length,
      abnormalTotal: abnormal,
      abnormalRatio: scored.length === 0 ? 0 : Math.round((abnormal / scored.length) * 10000) / 10000,
    } }, requestId);
    return true;
  }
  if (path === "/statistics/score-distribution" && method === "GET") {
    const user = authenticate(request);
    requirePermission(user, "assessment:read");
    const scaleCode = url.searchParams.get("scaleCode");
    const counts = new Map<string, number>();
    businessStore.listAssessments().filter((item) =>
      (!scaleCode || item.scaleCode === scaleCode) && item.scoreSummary.totalScore !== null,
    ).forEach((item) => {
      const key = String(item.scoreSummary.totalScore);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const distribution = [...counts].map(([score, count]) => ({ score: Number(score), count }))
      .sort((a, b) => a.score - b.score);
    sendJson(response, 200, { code: 0, message: "ok", data: { scaleCode, distribution } }, requestId);
    return true;
  }

  const reportMatch = path.match(/^\/reports\/assessments\/([^/]+)\.pdf$/);
  if (reportMatch && method === "GET") {
    const user = authenticate(request);
    requirePermission(user, "report:export");
    const assessment = businessStore.findAssessment(decodeURIComponent(reportMatch[1]));
    if (!assessment) throw new AuthError(404, 40401, "assessment not found");
    const patient = businessStore.findPatient(assessment.patientId);
    if (!patient) throw new AuthError(404, 40401, "patient not found");
    const content = createAssessmentPdf(patient, assessment);
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="assessment-${assessment.assessmentId}.pdf"`);
    response.setHeader("Content-Length", content.length);
    response.setHeader("X-Request-Id", requestId);
    response.end(content);
    addLog(user, requestId, "report.export_pdf", "assessment", assessment.assessmentId);
    return true;
  }
  if (path === "/reports/assessments.xls" && method === "GET") {
    const user = authenticate(request);
    requirePermission(user, "report:export");
    const content = createAssessmentsExcel(filterAssessments(url), businessStore.listPatients());
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
    response.setHeader("Content-Disposition", "attachment; filename=assessments.xls");
    response.setHeader("Content-Length", content.length);
    response.setHeader("X-Request-Id", requestId);
    response.end(content);
    addLog(user, requestId, "report.export_excel", "assessment", null);
    return true;
  }

  if (path === "/system/accounts" && method === "GET") {
    const user = authenticate(request);
    requirePermission(user, "system:admin");
    sendJson(response, 200, { code: 0, message: "ok", data: { accounts: listManagedUsers() } }, requestId);
    return true;
  }
  if (path === "/system/accounts" && method === "POST") {
    const user = authenticate(request);
    requirePermission(user, "system:admin");
    const body = objectBody(await readJsonBody(request));
    const roles = body.roleCodes;
    if (!Array.isArray(roles) || roles.length === 0 || roles.some((role) => !ROLE_CODES.includes(role as RoleCode))) {
      throw new AuthError(400, 40001, "roleCodes is invalid");
    }
    const account = createManagedUser({
      username: stringField(body, "username", { required: true })!,
      password: stringField(body, "password", { required: true })!,
      displayName: stringField(body, "displayName", { required: true })!,
      roleCodes: roles as RoleCode[],
      status: enumField(body, "status", ["active", "disabled", "pending"] as const) ?? "active",
    });
    addLog(user, requestId, "account.create", "user", account.userId, { username: account.username });
    sendJson(response, 201, { code: 0, message: "created", data: { account } }, requestId);
    return true;
  }
  const accountMatch = path.match(/^\/system\/accounts\/([^/]+)$/);
  if (accountMatch && method === "PATCH") {
    const user = authenticate(request);
    requirePermission(user, "system:admin");
    const accountId = decodeURIComponent(accountMatch[1]);
    const body = objectBody(await readJsonBody(request));
    const roles = body.roleCodes;
    if (roles !== undefined && (!Array.isArray(roles) || roles.length === 0 || roles.some((role) => !ROLE_CODES.includes(role as RoleCode)))) {
      throw new AuthError(400, 40001, "roleCodes is invalid");
    }
    if (accountId === user.userId && body.status === "disabled") {
      throw new AuthError(400, 40001, "cannot disable the current account");
    }
    const account = updateManagedUser(accountId, {
      displayName: stringField(body, "displayName") ?? undefined,
      roleCodes: roles as RoleCode[] | undefined,
      status: enumField(body, "status", ["active", "disabled", "pending"] as const) ?? undefined,
    });
    addLog(user, requestId, "account.update", "user", accountId);
    sendJson(response, 200, { code: 0, message: "ok", data: { account } }, requestId);
    return true;
  }
  if (path === "/system/password" && method === "PUT") {
    const user = authenticate(request);
    const body = objectBody(await readJsonBody(request));
    changePassword(
      user.userId,
      stringField(body, "currentPassword", { required: true })!,
      stringField(body, "newPassword", { required: true })!,
    );
    addLog(user, requestId, "account.password_change", "user", user.userId);
    sendJson(response, 200, { code: 0, message: "password changed; sign in again", data: null }, requestId);
    return true;
  }
  if (path === "/system/operation-logs" && method === "GET") {
    const user = authenticate(request);
    requirePermission(user, "operation_log:read");
    const { page, pageSize } = pagination(url);
    const action = url.searchParams.get("action");
    const userId = url.searchParams.get("userId");
    const logs = businessStore.listLogs().filter((log) =>
      (!action || log.action === action) && (!userId || log.userId === userId),
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    sendJson(response, 200, { code: 0, message: "ok", data: paged(logs, page, pageSize) }, requestId);
    return true;
  }
  return false;
}

export function getBusinessStoreStatus(): ReturnType<LocalBusinessStore["getStatus"]> {
  return businessStore.getStatus();
}
