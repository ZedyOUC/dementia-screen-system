import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { RoleCode } from "../auth/auth.js";

export type StoredUser = {
  userId: string;
  authProvider: "web" | "mini_program" | "seed";
  username: string | null;
  passwordHash: string | null;
  openId: string | null;
  displayName: string;
  roleCodes: readonly RoleCode[];
  status: "active" | "disabled" | "pending";
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserStoreStatus = {
  mode: "local_file";
  filePath: string;
  persistent: true;
  userCount: number;
};

export class LocalUserStore {
  private users: StoredUser[];

  constructor(
    private readonly filePath = resolve(
      process.env.LOCAL_DATA_DIR ?? resolve(process.cwd(), "data"),
      "users.json",
    ),
    seedUsers: readonly StoredUser[] = [],
  ) {
    this.users = this.load(seedUsers);
  }

  private load(seedUsers: readonly StoredUser[]): StoredUser[] {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error("local users store must contain an array");
      }
      return parsed as StoredUser[];
    } catch (error) {
      const fileDoesNotExist =
        error instanceof Error && "code" in error && error.code === "ENOENT";
      if (!fileDoesNotExist) {
        throw error;
      }
      mkdirSync(dirname(this.filePath), { recursive: true });
      this.persist(seedUsers);
      return [...seedUsers];
    }
  }

  private persist(users: readonly StoredUser[] = this.users): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(users, null, 2)}\n`, "utf8");
  }

  findByUsername(username: string): StoredUser | undefined {
    return this.users.find((user) => user.username === username);
  }

  findByUserId(userId: string): StoredUser | undefined {
    return this.users.find((user) => user.userId === userId);
  }

  list(): StoredUser[] {
    return this.users.map((user) => ({ ...user, roleCodes: [...user.roleCodes] }));
  }

  create(user: StoredUser): StoredUser {
    if (user.username && this.findByUsername(user.username)) {
      throw new Error("username already exists");
    }
    this.users.push(user);
    this.persist();
    return user;
  }

  update(
    userId: string,
    changes: Partial<Pick<StoredUser, "displayName" | "passwordHash" | "roleCodes" | "status">>,
  ): StoredUser | undefined {
    const user = this.findByUserId(userId);
    if (!user) {
      return undefined;
    }
    Object.assign(user, changes, { updatedAt: new Date().toISOString() });
    this.persist();
    return user;
  }

  updateLastLogin(userId: string, lastLoginAt: string): void {
    const user = this.findByUserId(userId);
    if (!user) {
      return;
    }
    user.lastLoginAt = lastLoginAt;
    user.updatedAt = lastLoginAt;
    this.persist();
  }

  getStatus(): UserStoreStatus {
    return {
      mode: "local_file",
      filePath: this.filePath,
      persistent: true,
      userCount: this.users.length,
    };
  }
}
