import { prisma } from "./db";
import { toJson } from "./json";

export const audit = (
  actorId: bigint | undefined,
  action: string,
  entity: string,
  entityId: bigint | number | string | null,
  meta?: unknown,
  ip?: string,
) =>
  prisma.auditLog.create({
    data: {
      actorId,
      action,
      entity,
      entityId: entityId == null ? null : String(entityId),
      meta: meta === undefined ? null : toJson(meta),
      ip,
    },
  });
