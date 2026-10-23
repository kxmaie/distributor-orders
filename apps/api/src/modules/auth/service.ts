import { RoleSchema, type RegisterBody } from "@do/shared";
import { prisma } from "../../lib/db";
import { HttpError } from "../../lib/errors";
import { dummyVerify, hashPassword, verifyPassword } from "../../lib/password";
import { newFamilyId, newRefreshToken, sha256 } from "../../lib/tokens";
import { LOCK_MINUTES, MAX_FAILED_LOGINS, REFRESH_TTL_DAYS } from "../../config";

type Meta = { ip?: string; userAgent?: string };

const addDays = (d: number) => new Date(Date.now() + d * 86_400_000);
const addMinutes = (m: number) => new Date(Date.now() + m * 60_000);

export const toPublicUser = (u: { id: bigint; username: string; fullName: string; role: string }) => ({
  id: u.id.toString(),
  username: u.username,
  fullName: u.fullName,
  role: RoleSchema.parse(u.role),
});

async function issueRefresh(userId: bigint, familyId: string, meta: Meta) {
  const token = newRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: sha256(token),
      expiresAt: addDays(REFRESH_TTL_DAYS),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 255),
    },
  });
  return token;
}

export async function login(username: string, password: string, meta: Meta) {
  const user = await prisma.user.findFirst({
    where: { username: { equals: username.trim(), mode: "insensitive" } },
  });

  if (!user) {
    await dummyVerify(password);
    throw new HttpError(401, "INVALID_CREDENTIALS");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(423, "ACCOUNT_LOCKED", "Too many failed attempts. Try again later.");
  }

  const ok = await verifyPassword(user.passwordHash, password).catch(() => false);
  if (!ok) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: lock ? { failedLogins: 0, lockedUntil: addMinutes(LOCK_MINUTES) } : { failedLogins: failed },
    });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: lock ? "login.locked" : "login.failed", entity: "user", entityId: user.id.toString(), ip: meta.ip },
    });
    throw new HttpError(401, "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new HttpError(403, "ACCOUNT_PENDING", "حسابك قيد المراجعة من قبل الإدارة، سيتم تفعيله قريباً");
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  const refreshToken = await issueRefresh(user.id, newFamilyId(), meta);
  return { user, refreshToken };
}

/** Rotating refresh tokens with reuse detection (revokes the whole family on reuse). */
export async function rotate(rawToken: string, meta: Meta) {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { user: true },
  });
  if (!row) throw new HttpError(401, "INVALID_REFRESH");

  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { actorId: row.userId, action: "refresh.reuse_detected", entity: "user", entityId: row.userId.toString(), ip: meta.ip },
    });
    throw new HttpError(401, "INVALID_REFRESH");
  }
  if (row.expiresAt < new Date() || !row.user.isActive) throw new HttpError(401, "INVALID_REFRESH");

  // Atomic claim: only one concurrent request can consume this token
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (claimed.count !== 1) throw new HttpError(401, "INVALID_REFRESH");

  const refreshToken = await issueRefresh(row.userId, row.familyId, meta);
  return { user: row.user, refreshToken };
}

export async function logout(rawToken: string | undefined) {
  if (!rawToken) return;
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
  if (row) {
    await prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export async function createPasswordRequest(username: string, note?: string) {
  const cleanUsername = username.trim().toLowerCase();
  const cleanNote = note?.trim().normalize("NFC");
  const user = await prisma.user.findFirst({
    where: { username: { equals: cleanUsername, mode: "insensitive" } },
  });
  // Caller always sees success (no username enumeration)
  const exists = await prisma.passwordRequest.findFirst({
    where: { username: { equals: cleanUsername, mode: "insensitive" }, status: "pending" },
  });
  if (!exists) await prisma.passwordRequest.create({ data: { username: cleanUsername, note: cleanNote, userId: user?.id } });
}

export async function getMe(userId: bigint) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw new HttpError(401, "UNAUTHORIZED");
  return toPublicUser(user);
}

export async function register(input: RegisterBody, ip?: string) {
  const username = input.username.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  });
  if (existing) throw new HttpError(409, "USERNAME_TAKEN", "اسم المستخدم مستخدم بالفعل، اختر اسماً آخر");

  const passwordHash = await hashPassword(input.password);
  const fullName = input.fullName.trim().normalize("NFC");
  const phone = input.phone?.trim() ?? null;
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      fullName,
      phone,
      role: "distributor",
      defaultDiscountPct: 0,
      isActive: false, // Inactive pending admin approval
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "user.register_pending",
      entity: "user",
      entityId: user.id.toString(),
      ip,
    },
  });

  return toPublicUser(user);
}

