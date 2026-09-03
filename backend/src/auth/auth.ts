import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { LocalUserStore, type StoredUser } from "../database/user-store.js";

export const ROLE_CODES = ["admin", "researcher", "evaluator"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSION_CODES = [
  "system:admin",
  "patient:read",
  "assessment:read",
  "assessment:create",
  "assessment:update",
  "scale:read",
  "file:read",
  "file:upload",
] as const;
export type PermissionCode = (typeof PERMISSION_CODES)[number];

const ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  admin: PERMISSION_CODES,
  researcher: [
    "patient:read",
    "assessment:read",
    "assessment:create",
    "assessment:update",
    "scale:read",
    "file:read",
    "file:upload",
  ],
  evaluator: [
    "patient:read",
    "assessment:read",
    "assessment:create",
    "assessment:update",
    "file:read",
    "file:upload",
  ],
};

const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 7200);
const PASSWORD_KEY_LENGTH = 64;

export type AuthUser = {
  userId: string;
  authProvider: "web" | "mini_program" | "seed";
  username: string | null;
  displayName: string;
  roleCodes: readonly RoleCode[];
  status: "active" | "disabled" | "pending";
  lastLoginAt: string | null;
};

type Session = {
  token: string;
  userId: string;
  expiresAt: number;
};

export class AuthError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function toPublicUser(user: StoredUser): AuthUser {
  return {
    userId: user.userId,
    authProvider: user.authProvider,
    username: user.username,
    displayName: user.displayName,
    roleCodes: user.roleCodes,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
  };
}

const now = new Date().toISOString();
const userStore = new LocalUserStore(undefined, [
  {
    userId: "usr_demo_admin",
    authProvider: "seed",
    username: "admin_demo",
    passwordHash: hashPassword("Admin123!"),
    openId: null,
    displayName: "Demo Administrator",
    roleCodes: ["admin"],
    status: "active",
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    userId: "usr_demo_researcher",
    authProvider: "seed",
    username: "researcher_demo",
    passwordHash: hashPassword("Researcher123!"),
    openId: null,
    displayName: "Demo Researcher",
    roleCodes: ["researcher"],
    status: "active",
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    userId: "usr_demo_evaluator",
    authProvider: "seed",
    username: "evaluator_demo",
    passwordHash: hashPassword("Evaluator123!"),
    openId: null,
    displayName: "Demo Evaluator",
    roleCodes: ["evaluator"],
    status: "active",
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  },
]);

const sessions = new Map<string, Session>();

function createSession(user: StoredUser): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + TOKEN_TTL_SECONDS * 1000;
  sessions.set(token, { token, userId: user.userId, expiresAt });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export function loginWithPassword(
  username: string,
  password: string,
): { token: string; expiresAt: string; user: AuthUser } {
  const user = userStore.findByUsername(username);
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    throw new AuthError(401, 40101, "invalid username or password");
  }
  if (user.status !== "active") {
    throw new AuthError(403, 40301, "user account is not active");
  }

  userStore.updateLastLogin(user.userId, new Date().toISOString());
  return { ...createSession(user), user: toPublicUser(user) };
}

export function loginWithMiniProgram(): never {
  throw new AuthError(503, 50301, "mini-program authentication is not configured");
}

export function authenticateToken(token: string): AuthUser {
  const session = sessions.get(token);
  if (!session) {
    throw new AuthError(401, 40101, "invalid or expired token");
  }
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    throw new AuthError(401, 40101, "invalid or expired token");
  }

  const user = userStore.findByUserId(session.userId);
  if (!user || user.status !== "active") {
    throw new AuthError(401, 40101, "user account is not active");
  }
  return toPublicUser(user);
}

export function revokeToken(token: string): void {
  sessions.delete(token);
}

export function getBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new AuthError(401, 40101, "missing bearer token");
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new AuthError(401, 40101, "missing bearer token");
  }
  return token;
}

export function requirePermission(user: AuthUser, permission: PermissionCode): void {
  const allowed = user.roleCodes.some((role) => ROLE_PERMISSIONS[role].includes(permission));
  if (!allowed) {
    throw new AuthError(403, 40301, `permission denied: ${permission}`);
  }
}

export function getAuthStatus(): {
  mode: "local_file";
  persistent: true;
  userCount: number;
  filePath: string;
  tokenTtlSeconds: number;
  miniProgramProvider: "not_configured";
} {
  const userStoreStatus = userStore.getStatus();
  return {
    mode: "local_file",
    persistent: true,
    userCount: userStoreStatus.userCount,
    filePath: userStoreStatus.filePath,
    tokenTtlSeconds: TOKEN_TTL_SECONDS,
    miniProgramProvider: "not_configured",
  };
}

export function createRequestUserId(): string {
  return randomUUID();
}
