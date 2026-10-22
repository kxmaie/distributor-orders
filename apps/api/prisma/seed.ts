import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PASSWORD_MIN_LENGTH } from "@do/shared";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_FULLNAME ?? "Super Admin";
  if (!username || !password) throw new Error("Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD");
  if (password.length < PASSWORD_MIN_LENGTH || password.startsWith("CHANGE_ME"))
    throw new Error(`SEED_ADMIN_PASSWORD must be a real password (>= ${PASSWORD_MIN_LENGTH} chars)`);

  await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, fullName, role: "super_admin", passwordHash: await hashPassword(password) },
  });

  if ((await prisma.warehouse.count()) === 0) await prisma.warehouse.create({ data: { name: "طنطا" } });
  console.log("Seed done.");
}

main().finally(() => prisma.$disconnect());
