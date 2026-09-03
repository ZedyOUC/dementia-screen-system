import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Assessment, BusinessData, OperationLog, Patient } from "./types.js";

const EMPTY_DATA: BusinessData = { patients: [], assessments: [], operationLogs: [] };

export class LocalBusinessStore {
  private data: BusinessData;

  constructor(
    private readonly filePath = resolve(
      process.env.LOCAL_DATA_DIR ?? resolve(process.cwd(), "data"),
      "business.json",
    ),
  ) {
    this.data = this.load();
  }

  private load(): BusinessData {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<BusinessData>;
      return {
        patients: Array.isArray(parsed.patients) ? parsed.patients : [],
        assessments: Array.isArray(parsed.assessments) ? parsed.assessments : [],
        operationLogs: Array.isArray(parsed.operationLogs) ? parsed.operationLogs : [],
      };
    } catch (error) {
      const missing = error instanceof Error && "code" in error && error.code === "ENOENT";
      if (!missing) throw error;
      this.persist(EMPTY_DATA);
      return structuredClone(EMPTY_DATA);
    }
  }

  private persist(data: BusinessData = this.data): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, this.filePath);
  }

  listPatients(): Patient[] { return this.data.patients; }
  findPatient(patientId: string): Patient | undefined {
    return this.data.patients.find((item) => item.patientId === patientId);
  }
  findPatientByCode(patientCode: string): Patient | undefined {
    return this.data.patients.find((item) => item.patientCode === patientCode);
  }
  savePatient(patient: Patient): Patient {
    const index = this.data.patients.findIndex((item) => item.patientId === patient.patientId);
    if (index >= 0) this.data.patients[index] = patient;
    else this.data.patients.push(patient);
    this.persist();
    return patient;
  }
  deletePatient(patientId: string): boolean {
    const oldLength = this.data.patients.length;
    this.data.patients = this.data.patients.filter((item) => item.patientId !== patientId);
    if (oldLength === this.data.patients.length) return false;
    this.persist();
    return true;
  }

  listAssessments(): Assessment[] { return this.data.assessments; }
  findAssessment(assessmentId: string): Assessment | undefined {
    return this.data.assessments.find((item) => item.assessmentId === assessmentId);
  }
  saveAssessment(assessment: Assessment): Assessment {
    const index = this.data.assessments.findIndex(
      (item) => item.assessmentId === assessment.assessmentId,
    );
    if (index >= 0) this.data.assessments[index] = assessment;
    else this.data.assessments.push(assessment);
    this.persist();
    return assessment;
  }

  addLog(input: Omit<OperationLog, "logId" | "createdAt" | "updatedAt">): OperationLog {
    const timestamp = new Date().toISOString();
    const log: OperationLog = {
      logId: randomUUID(),
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.data.operationLogs.push(log);
    this.persist();
    return log;
  }
  listLogs(): OperationLog[] { return this.data.operationLogs; }

  getStatus(): { mode: "local_file"; persistent: true; filePath: string } {
    return { mode: "local_file", persistent: true, filePath: this.filePath };
  }
}
