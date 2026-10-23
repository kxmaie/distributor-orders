import type { Prisma } from "@prisma/client";
import type { PasswordRequestQuery, PasswordResolveBody, UserApproveBody, UserCreate, UserListQuery, UserUpdate } from "@do/shared";
import type { z } from "zod";
import { prisma } from "../../lib/db";
import { audit } from "../../lib/audit";
import { HttpError } from "../../lib/errors";
import { hashPassword } from "../../lib/password";

type UserCreateInput = z.output<typeof UserCreate>;
type UserUpdateInput = z.output<typeof UserUpdate>;
type UserListQueryInput = z.output<typeof UserListQuery>;
type PasswordRequestQueryInput = z.output<typeof PasswordRequestQuery>;
type PasswordResolveInput = z.output<typeof PasswordResolveBody>;
type UserApproveInput = z.output<typeof UserApproveBody>;

const userSelect = {
  id: true,
  username: true,
  fullName: true,
  phone: true,
  role: true,
  defaultDiscountPct: true,
  isActive: true,
  failedLogins: true,
  lockedUntil: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export async function listUsers(q: UserListQueryInput) {
  const where: Prisma.UserWhereInput = { isActive: true }; // Only active users in the main list
  if (q.role) where.role = q.role;
  if (q.active !== undefined) where.isActive = q.active === "true";
  if (q.q) {
    where.OR = [
      { username: { contains: q.q, mode: "insensitive" } },
      { fullName: { contains: q.q, mode: "insensitive" } },
      { phone: { contains: q.q, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        ...userSelect,
        _count: { select: { orders: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  return { items, total, page: q.page, pageSize: q.pageSize };
}

/** List pending (not yet approved) distributor registrations */
export async function listPendingUsers(q: UserListQueryInput) {
  const where: Prisma.UserWhereInput = {
    isActive: false,
    role: "distributor",
  };
  if (q.q) {
    where.OR = [
      { username: { contains: q.q, mode: "insensitive" } },
      { fullName: { contains: q.q, mode: "insensitive" } },
      { phone: { contains: q.q, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ createdAt: "asc" }], // oldest first — most urgent
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  return { items, total, page: q.page, pageSize: q.pageSize };
}

/** Approve a pending distributor registration */
export async function approveUser(id: bigint, input: UserApproveInput, actorId: bigint, ip?: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "USER_NOT_FOUND", "المستخدم غير موجود");
  if (existing.isActive) throw new HttpError(400, "ALREADY_ACTIVE", "الحساب مفعّل بالفعل");

  const updated = await prisma.user.update({
    where: { id },
    data: {
      isActive: true,
      ...(input.defaultDiscountPct !== undefined ? { defaultDiscountPct: input.defaultDiscountPct } : {}),
    },
    select: userSelect,
  });

  await audit(actorId, "user.approve", "user", id, { username: existing.username }, ip);
  return updated;
}

/** Reject & permanently delete a pending distributor registration */
export async function rejectUser(id: bigint, actorId: bigint, ip?: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "USER_NOT_FOUND", "المستخدم غير موجود");
  if (existing.isActive) throw new HttpError(400, "CANNOT_REJECT_ACTIVE", "لا يمكن رفض حساب مفعّل");

  // Hard delete — pending user has no orders or history yet
  await prisma.user.delete({ where: { id } });
  await audit(actorId, "user.reject", "user", id, { username: existing.username }, ip);
}

export async function getUser(id: bigint) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...userSelect,
      orders: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNo: true,
          status: true,
          total: true,
          createdAt: true,
        },
      },
      _count: { select: { orders: true, discounts: true } },
    },
  });
  if (!user) throw new HttpError(404, "USER_NOT_FOUND", "المستخدم غير موجود");
  return user;
}

export async function createUser(input: UserCreateInput, actorId: bigint, ip?: string) {
  const username = input.username.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  });
  if (existing) throw new HttpError(409, "USERNAME_TAKEN", "اسم المستخدم مستخدم بالفعل");

  const passwordHash = await hashPassword(input.password);
  const fullName = input.fullName.trim().normalize("NFC");
  const phone = input.phone?.trim() ?? null;
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      fullName,
      phone,
      role: input.role,
      defaultDiscountPct: input.defaultDiscountPct,
    },
    select: userSelect,
  });

  await audit(actorId, "user.create", "user", user.id, { username: user.username, role: user.role }, ip);
  return user;
}

export async function updateUser(id: bigint, input: UserUpdateInput, actorId: bigint, ip?: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "USER_NOT_FOUND", "المستخدم غير موجود");

  const data: Prisma.UserUpdateInput = {};
  if (input.fullName !== undefined) data.fullName = input.fullName.trim().normalize("NFC");
  if (input.phone !== undefined) data.phone = input.phone?.trim() ?? null;
  if (input.role !== undefined) data.role = input.role;
  if (input.defaultDiscountPct !== undefined) data.defaultDiscountPct = input.defaultDiscountPct;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.password) {
    data.passwordHash = await hashPassword(input.password);
    data.failedLogins = 0;
    data.lockedUntil = null;
  }
  if (input.unlock) {
    data.failedLogins = 0;
    data.lockedUntil = null;
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });

  const meta: Record<string, unknown> = { ...input };
  if (meta.password) meta.password = "[REDACTED]";
  await audit(actorId, "user.update", "user", id, meta, ip);

  return updated;
}

export async function deleteUser(id: bigint, actorId: bigint, ip?: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "USER_NOT_FOUND", "المستخدم غير موجود");

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  await audit(actorId, "user.deactivate", "user", id, undefined, ip);
}

export async function listPasswordRequests(q: PasswordRequestQueryInput) {
  const where: Prisma.PasswordRequestWhereInput = {};
  if (q.status) where.status = q.status;

  const [total, items] = await Promise.all([
    prisma.passwordRequest.count({ where }),
    prisma.passwordRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            phone: true,
            role: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function resolvePasswordRequest(
  requestId: bigint,
  input: PasswordResolveInput,
  actorId: bigint,
  ip?: string,
) {
  const req = await prisma.passwordRequest.findUnique({
    where: { id: requestId },
    include: { user: true },
  });
  if (!req) throw new HttpError(404, "REQUEST_NOT_FOUND", "طلب إعادة التعيين غير موجود");
  if (req.status !== "pending") throw new HttpError(400, "ALREADY_RESOLVED", "تمت معالجة هذا الطلب مسبقاً");

  if (input.status === "resolved") {
    if (req.user && input.newPassword) {
      const passwordHash = await hashPassword(input.newPassword);
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          passwordHash,
          failedLogins: 0,
          lockedUntil: null,
        },
      });
    }

    const updated = await prisma.passwordRequest.update({
      where: { id: requestId },
      data: {
        status: "resolved",
        resolvedBy: actorId,
        resolvedAt: new Date(),
      },
    });

    await audit(actorId, "password_request.resolve", "password_request", requestId, { userId: req.userId?.toString() }, ip);
    return updated;
  } else {
    const updated = await prisma.passwordRequest.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        resolvedBy: actorId,
        resolvedAt: new Date(),
      },
    });

    await audit(actorId, "password_request.reject", "password_request", requestId, { userId: req.userId?.toString() }, ip);
    return updated;
  }
}
