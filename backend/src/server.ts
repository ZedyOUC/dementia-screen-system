import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { getDatabaseStatus } from "./database/runtime.js";
import {
  ALLOWED_FILE_TYPES,
  FILE_RELATED_TYPES,
  FileStoreError,
  LocalFileStore,
  MAX_FILE_SIZE_BYTES,
  type AllowedFileType,
  type FileRelatedType,
} from "./storage/file-store.js";
import {
  AuthError,
  authenticateToken,
  getAuthStatus,
  getBearerToken,
  loginWithMiniProgram,
  loginWithPassword,
  requirePermission,
  revokeToken,
  type AuthUser,
} from "./auth/auth.js";
import { getBusinessStoreStatus, handleBusinessRoute } from "./business/routes.js";

const port = Number(process.env.PORT ?? 3000);
const apiPrefix = process.env.API_PREFIX ?? "/api/v1";
const serviceVersion = process.env.SERVICE_VERSION ?? "0.1.0";
const startedAt = new Date();
const fileStore = new LocalFileStore();

type ApiResponse = {
  code: number;
  message: string;
  data: unknown;
  requestId: string;
};

function getRequestId(request: IncomingMessage): string {
  const suppliedId = request.headers["x-request-id"];
  return typeof suppliedId === "string" && suppliedId.trim() !== ""
    ? suppliedId.trim()
    : randomUUID();
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: Omit<ApiResponse, "requestId">,
  requestId: string,
): void {
  const body: ApiResponse = { ...payload, requestId };
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Request-Id", requestId);
  response.end(JSON.stringify(body));
}

function readJsonBody(
  request: IncomingMessage,
  maxBytes = 1024 * 1024,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBytes) {
        reject(new AuthError(413, 40001, "request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new AuthError(400, 40001, "request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function requireBodyString(body: unknown, field: string): string {
  if (
    typeof body !== "object" ||
    body === null ||
    !(field in body) ||
    typeof (body as Record<string, unknown>)[field] !== "string" ||
    (body as Record<string, unknown>)[field]?.toString().trim() === ""
  ) {
    throw new AuthError(400, 40001, `${field} is required`);
  }
  return (body as Record<string, string>)[field].trim();
}

function requireBodyOption<T extends string>(
  body: unknown,
  field: string,
  options: readonly T[],
): T {
  const value = requireBodyString(body, field);
  if (!options.includes(value as T)) {
    throw new AuthError(400, 40001, `${field} is invalid`);
  }
  return value as T;
}

function requireUser(request: IncomingMessage): { user: AuthUser; token: string } {
  const token = getBearerToken(request.headers.authorization);
  return { token, user: authenticateToken(token) };
}

function sendAuthError(response: ServerResponse, error: unknown, requestId: string): void {
  if (error instanceof AuthError) {
    sendJson(
      response,
      error.statusCode,
      { code: error.code, message: error.message, data: null },
      requestId,
    );
    return;
  }
  sendJson(
    response,
    500,
    { code: 50001, message: "internal server error", data: null },
    requestId,
  );
}

export async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestId = getRequestId(request);
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");
  const requestStartedAt = Date.now();
  response.on("finish", () => {
    if (process.env.LOG_LEVEL !== "silent") {
      console.log(
        JSON.stringify({
          type: "http_request",
          requestId,
          method,
          path: url.pathname,
          statusCode: response.statusCode,
          durationMs: Date.now() - requestStartedAt,
        }),
      );
    }
  });

  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

  if (method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  try {
    if (method === "GET" && url.pathname === `${apiPrefix}/health`) {
    sendJson(
      response,
      200,
      {
        code: 0,
        message: "ok",
        data: {
          status: "healthy",
          service: "ad-scd-backend",
          version: serviceVersion,
          environment: process.env.NODE_ENV ?? "development",
          startedAt: startedAt.toISOString(),
          uptimeSeconds: Math.floor(process.uptime()),
          dependencies: {
            database: getDatabaseStatus(),
            businessStore: getBusinessStoreStatus(),
            objectStorage: {
              ...fileStore.getStatus(),
            },
          },
          authentication: getAuthStatus(),
        },
      },
      requestId,
    );
    return;
  }

    if (method === "POST" && url.pathname === `${apiPrefix}/auth/web/login`) {
      const body = await readJsonBody(request);
      const username = requireBodyString(body, "username");
      const password = requireBodyString(body, "password");
      const result = loginWithPassword(username, password);
      sendJson(response, 200, { code: 0, message: "ok", data: result }, requestId);
      return;
    }

    if (method === "POST" && url.pathname === `${apiPrefix}/auth/mini-program/login`) {
      loginWithMiniProgram();
    }

    if (method === "GET" && url.pathname === `${apiPrefix}/auth/me`) {
      const { user } = requireUser(request);
      sendJson(response, 200, { code: 0, message: "ok", data: { user } }, requestId);
      return;
    }

    if (method === "POST" && url.pathname === `${apiPrefix}/auth/logout`) {
      const { token } = requireUser(request);
      revokeToken(token);
      sendJson(response, 200, { code: 0, message: "ok", data: null }, requestId);
      return;
    }

    if (method === "POST" && url.pathname === `${apiPrefix}/files`) {
      const { user } = requireUser(request);
      requirePermission(user, "file:upload");
      const body = await readJsonBody(request, 30 * 1024 * 1024);
      const originalName = requireBodyString(body, "originalName");
      const mimeType = requireBodyOption(body, "mimeType", ALLOWED_FILE_TYPES);
      const relatedType = requireBodyOption(body, "relatedType", FILE_RELATED_TYPES);
      const relatedId = requireBodyString(body, "relatedId");
      const contentBase64 = requireBodyString(body, "contentBase64");
      const file = fileStore.create({
        originalName,
        mimeType: mimeType as AllowedFileType,
        contentBase64,
        relatedType: relatedType as FileRelatedType,
        relatedId,
        uploadedBy: user.userId,
      });
      sendJson(response, 201, { code: 0, message: "created", data: { file } }, requestId);
      return;
    }

    if (method === "GET" && url.pathname === `${apiPrefix}/files`) {
      const { user } = requireUser(request);
      requirePermission(user, "file:read");
      const relatedTypeValue = url.searchParams.get("relatedType") ?? undefined;
      const relatedId = url.searchParams.get("relatedId") ?? undefined;
      if (
        relatedTypeValue &&
        !FILE_RELATED_TYPES.includes(relatedTypeValue as FileRelatedType)
      ) {
        throw new AuthError(400, 40001, "relatedType is invalid");
      }
      const files = fileStore.list(
        relatedTypeValue as FileRelatedType | undefined,
        relatedId,
      );
      sendJson(response, 200, { code: 0, message: "ok", data: { files } }, requestId);
      return;
    }

    const filePathPrefix = `${apiPrefix}/files/`;
    if (method === "GET" && url.pathname.startsWith(filePathPrefix)) {
      const { user } = requireUser(request);
      requirePermission(user, "file:read");
      const routeParts = url.pathname
        .slice(filePathPrefix.length)
        .split("/")
        .filter(Boolean)
        .map((part) => decodeURIComponent(part));
      const fileId = routeParts[0];
      const file = fileId ? fileStore.findById(fileId) : undefined;
      if (!file) {
        sendJson(
          response,
          404,
          { code: 40401, message: "file not found", data: null },
          requestId,
        );
        return;
      }
      if (routeParts[1] === "download") {
        const content = fileStore.readContent(file);
        response.statusCode = 200;
        response.setHeader("Content-Type", file.mimeType);
        response.setHeader("Content-Length", content.length);
        response.setHeader(
          "Content-Disposition",
          `attachment; filename="${file.originalName.replace(/"/g, "")}"`,
        );
        response.setHeader("X-Request-Id", requestId);
        response.end(content);
        return;
      }
      sendJson(response, 200, { code: 0, message: "ok", data: { file } }, requestId);
      return;
    }

    if (method === "GET" && url.pathname === `${apiPrefix}/system/admin-check`) {
      const { user } = requireUser(request);
      requirePermission(user, "system:admin");
      sendJson(
        response,
        200,
        { code: 0, message: "ok", data: { authorized: true, roleCodes: user.roleCodes } },
        requestId,
      );
      return;
    }

    if (await handleBusinessRoute({
      request,
      response,
      url,
      method,
      requestId,
      apiPrefix,
      sendJson,
      readJsonBody,
    })) {
      return;
    }

    sendJson(
      response,
      404,
      {
        code: 40401,
        message: "resource not found",
        data: null,
      },
      requestId,
    );
  } catch (error) {
    if (error instanceof FileStoreError) {
      sendJson(
        response,
        400,
        { code: 40002, message: error.message, data: null },
        requestId,
      );
      return;
    }
    sendAuthError(response, error, requestId);
  }
}

export function createBackendServer() {
  return createServer(handleRequest);
}

const isEntryPoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntryPoint) {
  const server = createBackendServer();
  server.listen(port, () => {
    console.log(`AD SCD backend listening on http://localhost:${port}`);
    console.log(`Health endpoint: http://localhost:${port}${apiPrefix}/health`);
  });
  const shutdown = (signal: string): void => {
    console.log(`Received ${signal}; shutting down`);
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
