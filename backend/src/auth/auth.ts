import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { LocalUserStore, type StoredUser } from "../database/user-store.js";

export const ROLE_CODES = ["admin", "researcher", "evaluator"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSION_CODES = [
  "system:admin",
  "patient:read",
  "patient:create",
  "patient:update",
  "patient:delete",
  "assessment:read",
  "assessment:create",
  "assessment:update",
  "scale:read",
  "report:export",
  "operation_log:read",
  "file:read",
  "file:upload",
] as const;
export type PermissionCode = (typeof PERMISSION_CODES)[number];

const ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  admin: PERMISSION_CODES,
  researcher: [
    "patient:read",
    "patient:create",
    "patient:update",
    "assessment:read",
    "assessment:create",
    "assessment:update",
    "scale:read",
    "report:export",
    "operation_log:read",
    "file:read",
    "file:upload",
  ],
  evaluator: [
    "patient:read",
    "patient:create",
    "patient:update",
    "assessment:read",
    "assessment:create",
    "assessment:update",
    "scale:read",
    "report:export",
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

export type ManagedUser = AuthUser & { createdAt: string; updatedAt: string };

function toManagedUser(user: StoredUser): ManagedUser {
  return { ...toPublicUser(user), createdAt: user.createdAt, updatedAt: user.updatedAt };
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

export function listManagedUsers(): ManagedUser[] {
  return userStore.list().map(toManagedUser);
}

export function createManagedUser(input: {
  username: string;
  password: string;
  displayName: string;
  roleCodes: readonly RoleCode[];
  status?: StoredUser["status"];
}): ManagedUser {
  if (input.password.length < 8) {
    throw new AuthError(400, 40001, "password must contain at least 8 characters");
  }
  if (userStore.findByUsername(input.username)) {
    throw new AuthError(409, 40901, "username already exists");
  }
  const timestamp = new Date().toISOString();
  const user: StoredUser = {
    userId: randomUUID(),
    authProvider: "web",
    username: input.username,
    passwordHash: hashPassword(input.password),
    openId: null,
    displayName: input.displayName,
    roleCodes: [...input.roleCodes],
    status: input.status ?? "active",
    lastLoginAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  userStore.create(user);
  return toManagedUser(user);
}

export function updateManagedUser(
  userId: string,
  changes: { displayName?: string; roleCodes?: readonly RoleCode[]; status?: StoredUser["status"] },
): ManagedUser {
  const updated = userStore.update(userId, changes);
  if (!updated) {
    throw new AuthError(404, 40401, "user not found");
  }
  return toManagedUser(updated);
}

export function changePassword(userId: string, oldPassword: string, newPassword: string): void {
  const user = userStore.findByUserId(userId);
  if (!user || !user.passwordHash || !verifyPassword(oldPassword, user.passwordHash)) {
    throw new AuthError(400, 40001, "current password is incorrect");
  }
  if (newPassword.length < 8) {
    throw new AuthError(400, 40001, "new password must contain at least 8 characters");
  }
  userStore.update(userId, { passwordHash: hashPassword(newPassword) });
  for (const [token, session] of sessions.entries()) {
    if (session.userId === userId) {
      sessions.delete(token);
    }
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
