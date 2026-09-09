import { Request, Response } from "express";
import {
  AuthorizationRepository,
  isRole,
} from "../auth/AuthorizationRepository";
import {
  AuthorizationError,
  ValidationError,
} from "../errors/ApplicationErrors";
import { requirePermission, requirePrincipal } from "../middleware/auth";
import { parseId } from "../utils/http";

export class AuthorizationController {
  constructor(private readonly repository: AuthorizationRepository) {}
  assignRole = async (req: Request, res: Response) => {
    const principal = requirePermission(req, "ROLE_MANAGE");
    const role = req.body?.role;
    if (!isRole(role))
      throw new ValidationError({
        role: "must be READER, MODERATOR, or ADMIN.",
      });
    const userId = parseId(req.params.userId, "userId");
    if (userId === principal.id && role !== "READER")
      throw new AuthorizationError(
        "Administrators cannot elevate their own role.",
      );
    res
      .status(201)
      .json({
        data: await this.repository.assignRole({
          userId,
          role,
          assignedBy: principal.id,
        }),
      });
  };
  revokeRole = async (req: Request, res: Response) => {
    const principal = requirePermission(req, "ROLE_MANAGE");
    const role = req.body?.role;
    if (!isRole(role))
      throw new ValidationError({
        role: "must be READER, MODERATOR, or ADMIN.",
      });
    const userId = parseId(req.params.userId, "userId");
    if (userId === principal.id && role === "ADMIN")
      throw new AuthorizationError(
        "Administrators cannot remove their own ADMIN role.",
      );
    const removed = await this.repository.revokeRole(userId, role);
    res.status(removed ? 204 : 404).send();
  };
  me = async (req: Request, res: Response) => {
    const principal = requirePrincipal(req);
    res.json({
      data: {
        id: principal.id,
        email: principal.email,
        roles: principal.roles || [principal.role],
        permissions: principal.permissions || [],
        territory: principal.territory || null,
      },
    });
  };
}
