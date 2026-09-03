import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export const FILE_RELATED_TYPES = [
  "scale_config",
  "assessment",
  "patient",
  "report",
] as const;
export type FileRelatedType = (typeof FILE_RELATED_TYPES)[number];

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export class FileStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileStoreError";
  }
}

export type StoredFile = {
  fileId: string;
  originalName: string;
  storageKey: string;
  mimeType: AllowedFileType;
  sizeBytes: number;
  relatedType: FileRelatedType;
  relatedId: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type FileStoreStatus = {
  mode: "local_file";
  configured: false;
  rootDir: string;
  metadataPath: string;
  fileCount: number;
};

function sanitizeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .slice(0, 180);
  return cleaned || "upload.bin";
}

export class LocalFileStore {
  private readonly rootDir: string;
  private readonly metadataPath: string;
  private files: StoredFile[];

  constructor(dataDir = resolve(process.env.LOCAL_DATA_DIR ?? resolve(process.cwd(), "data"))) {
    this.rootDir = join(dataDir, "files");
    this.metadataPath = join(dataDir, "files.json");
    this.files = this.load();
  }

  private load(): StoredFile[] {
    try {
      const parsed = JSON.parse(readFileSync(this.metadataPath, "utf8")) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error("local files store must contain an array");
      }
      return parsed as StoredFile[];
    } catch (error) {
      const fileDoesNotExist =
        error instanceof Error && "code" in error && error.code === "ENOENT";
      if (!fileDoesNotExist) {
        throw error;
      }
      mkdirSync(join(this.rootDir, ".."), { recursive: true });
      this.persist([]);
      return [];
    }
  }

  private persist(files: readonly StoredFile[] = this.files): void {
    mkdirSync(join(this.metadataPath, ".."), { recursive: true });
    writeFileSync(this.metadataPath, `${JSON.stringify(files, null, 2)}\n`, "utf8");
  }

  create(input: {
    originalName: string;
    mimeType: AllowedFileType;
    contentBase64: string;
    relatedType: FileRelatedType;
    relatedId: string;
    uploadedBy: string;
  }): StoredFile {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64)) {
      throw new FileStoreError("contentBase64 is invalid");
    }
    const content = Buffer.from(input.contentBase64, "base64");
    if (content.length === 0) {
      throw new FileStoreError("file content must not be empty");
    }
    if (content.length > MAX_FILE_SIZE_BYTES) {
      throw new FileStoreError(`file exceeds ${MAX_FILE_SIZE_BYTES} byte limit`);
    }

    const now = new Date().toISOString();
    const fileId = randomUUID();
    const safeName = sanitizeFileName(input.originalName);
    const fileDir = join(this.rootDir, fileId);
    const filePath = join(fileDir, safeName);
    mkdirSync(fileDir, { recursive: true });
    writeFileSync(filePath, content);

    const storedFile: StoredFile = {
      fileId,
      originalName: safeName,
      storageKey: `local/${fileId}/${safeName}`,
      mimeType: input.mimeType,
      sizeBytes: content.length,
      relatedType: input.relatedType,
      relatedId: input.relatedId.trim(),
      uploadedBy: input.uploadedBy,
      createdAt: now,
      updatedAt: now,
    };
    this.files.push(storedFile);
    this.persist();
    return storedFile;
  }

  findById(fileId: string): StoredFile | undefined {
    return this.files.find((file) => file.fileId === fileId);
  }

  list(relatedType?: FileRelatedType, relatedId?: string): StoredFile[] {
    return this.files.filter(
      (file) =>
        (!relatedType || file.relatedType === relatedType) &&
        (!relatedId || file.relatedId === relatedId),
    );
  }

  readContent(file: StoredFile): Buffer {
    const fileName = sanitizeFileName(file.originalName);
    return readFileSync(join(this.rootDir, file.fileId, fileName));
  }

  getStatus(): FileStoreStatus {
    return {
      mode: "local_file",
      configured: false,
      rootDir: this.rootDir,
      metadataPath: this.metadataPath,
      fileCount: this.files.length,
    };
  }
}
