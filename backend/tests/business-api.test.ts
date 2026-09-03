import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";

const testDataDirectory = mkdtempSync(join(tmpdir(), "ad-scd-task3-"));
process.env.LOCAL_DATA_DIR = testDataDirectory;
process.env.LOG_LEVEL = "silent";

const { createBackendServer } = await import("../src/server.js");
const server = createBackendServer();
let baseUrl = "";
let adminToken = "";
let patientId = "";
let assessmentId = "";

before(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(testDataDirectory, { recursive: true, force: true });
});

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...init.headers,
    },
  });
}

test("admin can log in and create a patient", async () => {
  const login = await api("/auth/web/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin_demo", password: "Admin123!" }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json() as { data: { token: string } };
  adminToken = loginBody.data.token;

  const created = await api("/patients", {
    method: "POST",
    body: JSON.stringify({
      patientCode: "TEST-001",
      name: "测试患者",
      gender: "female",
      educationYears: 12,
      profile: { source: "automated-test" },
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json() as { data: { patient: { patientId: string } } };
  patientId = createdBody.data.patient.patientId;

  const list = await api("/patients?keyword=TEST-001");
  const listBody = await list.json() as { data: { total: number } };
  assert.equal(listBody.data.total, 1);
});

test("submitted SCD-Q9 assessment is scored from task-1 configuration", async () => {
  const frequencyItems = new Set([4, 5, 7]);
  const answers = Array.from({ length: 9 }, (_, index) => ({
    itemCode: `SCD_Q9_${String(index + 1).padStart(2, "0")}`,
    optionCode: frequencyItems.has(index + 1) ? "从未" : "否",
  }));
  const created = await api("/assessments", {
    method: "POST",
    body: JSON.stringify({ patientId, scaleCode: "SCD_Q9", status: "submitted", answers }),
  });
  assert.equal(created.status, 201);
  const body = await created.json() as {
    data: { assessment: { assessmentId: string; scoreSummary: { totalScore: number; scoringStatus: string } } };
  };
  assessmentId = body.data.assessment.assessmentId;
  assert.equal(body.data.assessment.scoreSummary.totalScore, 0);
  assert.equal(body.data.assessment.scoreSummary.scoringStatus, "calculated");

  const details = await api(`/assessments/${assessmentId}`);
  assert.equal(details.status, 200);
});

test("statistics and report exports are available", async () => {
  const overview = await api("/statistics/overview");
  const overviewBody = await overview.json() as { data: { patientTotal: number; assessmentTotal: number } };
  assert.equal(overviewBody.data.patientTotal, 1);
  assert.equal(overviewBody.data.assessmentTotal, 1);

  const pdf = await api(`/reports/assessments/${assessmentId}.pdf`);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");

  const excel = await api("/reports/assessments.xls");
  assert.equal(excel.status, 200);
  assert.match(await excel.text(), /<Workbook/);
});

test("admin can manage accounts and query operation logs", async () => {
  const account = await api("/system/accounts", {
    method: "POST",
    body: JSON.stringify({
      username: "api_test_user",
      password: "Example123!",
      displayName: "API Test User",
      roleCodes: ["evaluator"],
    }),
  });
  assert.equal(account.status, 201);

  const logs = await api("/system/operation-logs?pageSize=100");
  const body = await logs.json() as { data: { total: number; items: { action: string }[] } };
  assert.ok(body.data.total >= 4);
  assert.ok(body.data.items.some((item) => item.action === "assessment.create"));
});
