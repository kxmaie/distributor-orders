import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PASSWORD_MIN_LENGTH } from "@do/shared";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const demo = process.env.DEMO_MODE === "true";
  const username = (demo ? process.env.DEMO_SEED_ADMIN_USERNAME : process.env.SEED_ADMIN_USERNAME)?.trim().toLowerCase();
  const password = demo ? process.env.DEMO_SEED_ADMIN_PASSWORD : process.env.SEED_ADMIN_PASSWORD;
  const fullName = (demo ? process.env.DEMO_SEED_ADMIN_FULLNAME : process.env.SEED_ADMIN_FULLNAME) ?? (demo ? "Demo Admin" : "Super Admin");
  if (!username || !password) throw new Error("Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD");
  if (password.length < PASSWORD_MIN_LENGTH || password.startsWith("CHANGE_ME"))
    throw new Error(`SEED_ADMIN_PASSWORD must be a real password (>= ${PASSWORD_MIN_LENGTH} chars)`);

  await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, fullName, role: "super_admin", passwordHash: await hashPassword(password) },
  });

  if ((await prisma.warehouse.count()) === 0) await prisma.warehouse.create({ data: { name: "طنطا" } });
  if (process.env.DEMO_MODE === "true") await seedDemoCatalog();
  console.log("Seed done.");
}


async function seedDemoCatalog() {
  const category = await prisma.category.upsert({
    where: { slug: "demo-products" },
    update: { name: "منتجات العرض", isActive: true },
    create: { name: "منتجات العرض", slug: "demo-products", sortOrder: 1 },
  });
  const warehouse = await prisma.warehouse.findFirst({ where: { name: "معرض تجريبي" } })
    ?? await prisma.warehouse.create({ data: { name: "معرض تجريبي" } });
  const samples = [
    { name: "قلم تركي فاخر", sku: "DEMO-PEN-BLACK", price: 48.5, label: "أسود", quantity: 240 },
    { name: "سبحة زجاج ملونة", sku: "DEMO-BEADS-BLUE", price: 72, label: "أزرق", quantity: 160 },
    { name: "إكسسوار مكتبي", sku: "DEMO-DESK-GOLD", price: 125, label: "ذهبي", quantity: 85 },
  ];

  for (const sample of samples) {
    let product = await prisma.product.findFirst({ where: { name: sample.name } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          categoryId: category.id,
          name: sample.name,
          description: "منتج تجريبي لشرح إدارة الكتالوج والطلبات والمخزون.",
          basePrice: sample.price,
          unit: "piece",
          piecesPerUnit: 1,
        },
      });
    }
    let variant = await prisma.productVariant.findUnique({ where: { sku: sample.sku } });
    if (!variant) variant = await prisma.productVariant.create({ data: { productId: product.id, sku: sample.sku, label: sample.label, priceDelta: 0 } });
    await prisma.stockLevel.upsert({
      where: { variantId_warehouseId: { variantId: variant.id, warehouseId: warehouse.id } },
      update: { onHand: sample.quantity, reserved: 0 },
      create: { variantId: variant.id, warehouseId: warehouse.id, onHand: sample.quantity },
    });
  }
}
main().finally(() => prisma.$disconnect());
