import { randomUUID } from "node:crypto";
import { Collection, Db } from "mongodb";

export type NexaraRole = "READER" | "MODERATOR" | "ADMIN";
export type Permission =
  | "CATALOG_WRITE"
  | "FILE_WRITE"
  | "RIGHTS_MANAGE"
  | "AUDIT_READ"
  | "ROLE_MANAGE";

export interface RoleAssignment {
  id: string;
  userId: string;
  role: NexaraRole;
  assignedBy: string;
  createdAt: string;
}

const rolePermissions: Record<NexaraRole, Permission[]> = {
  READER: [],
  MODERATOR: ["CATALOG_WRITE"],
  ADMIN: [
    "CATALOG_WRITE",
    "FILE_WRITE",
    "RIGHTS_MANAGE",
    "AUDIT_READ",
    "ROLE_MANAGE",
  ],
};
export function permissionsForRoles(roles: NexaraRole[]): Permission[] {
  return Array.from(
    new Set(roles.flatMap((role) => rolePermissions[role] || [])),
  );
}
export function primaryRole(roles: NexaraRole[]): NexaraRole {
  return roles.includes("ADMIN")
    ? "ADMIN"
    : roles.includes("MODERATOR")
      ? "MODERATOR"
      : "READER";
}
export function isRole(value: unknown): value is NexaraRole {
  return value === "READER" || value === "MODERATOR" || value === "ADMIN";
}

export interface AuthorizationRepository {
  rolesForUser(userId: string): Promise<NexaraRole[]>;
  assignRole(input: {
    userId: string;
    role: NexaraRole;
    assignedBy: string;
  }): Promise<RoleAssignment>;
  revokeRole(userId: string, role: NexaraRole): Promise<boolean>;
}

export class InMemoryAuthorizationRepository implements AuthorizationRepository {
  private readonly assignments = new Map<string, RoleAssignment>();
  async rolesForUser(userId: string): Promise<NexaraRole[]> {
    const roles: NexaraRole[] = [...this.assignments.values()]
      .filter((assignment) => assignment.userId === userId)
      .map((assignment) => assignment.role);
    return roles.length ? Array.from(new Set(roles)) : ["READER"];
  }
  async assignRole(input: {
    userId: string;
    role: NexaraRole;
    assignedBy: string;
  }) {
    const existing = [...this.assignments.values()].find(
      (assignment) =>
        assignment.userId === input.userId && assignment.role === input.role,
    );
    if (existing) return structuredClone(existing);
    const record: RoleAssignment = {
      id: `role-${randomUUID()}`,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.assignments.set(record.id, record);
    return structuredClone(record);
  }
  async revokeRole(userId: string, role: NexaraRole) {
    const target = [...this.assignments.values()].find(
      (assignment) => assignment.userId === userId && assignment.role === role,
    );
    return target ? this.assignments.delete(target.id) : false;
  }
}

export class MongoAuthorizationRepository implements AuthorizationRepository {
  private readonly assignments: Collection<RoleAssignment>;
  constructor(db: Db) {
    this.assignments = db.collection<RoleAssignment>("role_assignments");
  }
  async rolesForUser(userId: string): Promise<NexaraRole[]> {
    const rows = await this.assignments
      .find({ userId }, { projection: { _id: 0, role: 1 } })
      .toArray();
    const roles: NexaraRole[] = rows.map((row) => row.role).filter(isRole);
    return roles.length ? Array.from(new Set(roles)) : ["READER"];
  }
  async assignRole(input: {
    userId: string;
    role: NexaraRole;
    assignedBy: string;
  }) {
    const existing = await this.assignments.findOne(
      { userId: input.userId, role: input.role },
      { projection: { _id: 0 } },
    );
    if (existing) return existing;
    const record: RoleAssignment = {
      id: `role-${randomUUID()}`,
      ...input,
      createdAt: new Date().toISOString(),
    };
    await this.assignments.insertOne(record);
    return record;
  }
  async revokeRole(userId: string, role: NexaraRole) {
    return (
      (await this.assignments.deleteOne({ userId, role })).deletedCount === 1
    );
  }
}
