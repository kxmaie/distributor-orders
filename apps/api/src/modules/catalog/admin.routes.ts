import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import {
  AdminProductQuery, CategoryCreate, CategoryUpdate, IdParam, IntIdParam, ProductCreate, ProductUpdate,
  VariantCreate, VariantUpdate, WarehouseCreate, WarehouseUpdate,
} from "@do/shared";
import { prisma } from "../../lib/db";
import { audit } from "../../lib/audit";
import { HttpError } from "../../lib/errors";
import { slugify } from "../../lib/slug";

const adminCatalogRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireRole("super_admin"));
  const actor = (req: FastifyRequest) => BigInt(req.user.sub);

  app.post("/uploads/image", async (req, reply) => {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new HttpError(503, "IMAGE_STORAGE_NOT_CONFIGURED", "Image storage is not configured");
    }
    try {
      const result = await handleUpload({
        body: req.body as HandleUploadBody,
        request: req.raw,
        onBeforeGenerateToken: async (pathname) => {
          if (!/^products\/[^/]+$/.test(pathname)) {
            throw new HttpError(400, "INVALID_UPLOAD_PATH");
          }
          return {
            allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
            maximumSizeInBytes: 5 * 1024 * 1024,
            addRandomSuffix: true,
            allowOverwrite: false,
          };
        },
      });
      return reply.send(result);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, "IMAGE_UPLOAD_FAILED", "Could not authorize image upload");
    }
  });

  // ---------- categories ----------
  app.get("/categories", async () =>
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  );

  app.post("/categories", async (req, reply) => {
    const b = CategoryCreate.parse(req.body);
    const slug = b.slug ?? slugify(b.name);
    if (!slug) throw new HttpError(400, "SLUG_REQUIRED", "Provide an English slug (a-z, 0-9, '-')");
    const row = await prisma.category.create({ data: { name: b.name, slug, sortOrder: b.sortOrder } });
    await audit(actor(req), "category.create", "category", row.id, b, req.ip);
    return reply.code(201).send(row);
  });

  app.patch("/categories/:id", async (req) => {
    const { id } = IntIdParam.parse(req.params);
    const data = CategoryUpdate.parse(req.body);
    const row = await prisma.category.update({ where: { id }, data });
    await audit(actor(req), "category.update", "category", id, data, req.ip);
    return row;
  });

  const hardDeleteCategory = async (id: number, actorId: bigint, ip?: string) => {
    const existing = await prisma.category.findUnique({
      where: { id },
      include: { products: { select: { id: true, name: true } } },
    });
    if (!existing) throw new HttpError(404, "CATEGORY_NOT_FOUND", "التصنيف غير موجود");

    await prisma.$transaction(async (tx) => {
      const productIds = existing.products.map((p) => p.id);
      if (productIds.length > 0) {
        const variants = await tx.productVariant.findMany({
          where: { productId: { in: productIds } },
          select: { id: true },
        });
        const variantIds = variants.map((v) => v.id);
        if (variantIds.length > 0) {
          await tx.orderItem.deleteMany({ where: { variantId: { in: variantIds } } });
          await tx.reservation.deleteMany({ where: { variantId: { in: variantIds } } });
          await tx.stockMovement.deleteMany({ where: { variantId: { in: variantIds } } });
          await tx.stockLevel.deleteMany({ where: { variantId: { in: variantIds } } });
          await tx.productVariant.deleteMany({ where: { id: { in: variantIds } } });
        }
        await tx.discount.deleteMany({ where: { productId: { in: productIds } } });
        await tx.product.deleteMany({ where: { id: { in: productIds } } });
      }

      await tx.discount.deleteMany({ where: { categoryId: id } });
      await tx.category.delete({ where: { id } });

      const emptyOrders = await tx.order.findMany({ where: { items: { none: {} } }, select: { id: true } });
      if (emptyOrders.length > 0) {
        const emptyOrderIds = emptyOrders.map((o) => o.id);
        await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: emptyOrderIds } } });
        await tx.reservation.deleteMany({ where: { orderId: { in: emptyOrderIds } } });
        await tx.order.deleteMany({ where: { id: { in: emptyOrderIds } } });
      }
    });

    await audit(actorId, "category.force_delete", "category", id, { name: existing.name }, ip);
  };

  app.delete("/categories/:id/force", async (req, reply) => {
    const { id } = IntIdParam.parse(req.params);
    await hardDeleteCategory(id, actor(req), req.ip);
    return reply.code(204).send();
  });

  app.delete("/categories/:id", async (req, reply) => {
    const { id } = IntIdParam.parse(req.params);
    const isHard = (req.query as { hard?: string })?.hard === "true";
    if (isHard) {
      await hardDeleteCategory(id, actor(req), req.ip);
      return reply.code(204).send();
    }
    await prisma.category.update({ where: { id }, data: { isActive: false } }); // soft delete
    await audit(actor(req), "category.deactivate", "category", id, undefined, req.ip);
    return reply.code(204).send();
  });

  // ---------- products ----------
  app.get("/products", async (req) => {
    const q = AdminProductQuery.parse(req.query);
    const where: Prisma.ProductWhereInput = {};
    if (q.active) where.isActive = q.active === "true";
    if (q.category) where.category = /^\d+$/.test(q.category) ? { id: Number(q.category) } : { slug: q.category };
    if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { description: { contains: q.q, mode: "insensitive" } }];
    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          variants: {
            orderBy: { id: "asc" },
            include: {
              stockLevels: {
                include: { warehouse: { select: { id: true, name: true, isActive: true } } },
              },
            },
          },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  });

  app.get("/products/:id", async (req) => {
    const { id } = IdParam.parse(req.params);
    const p = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: {
          orderBy: { id: "asc" },
          include: {
            stockLevels: {
              include: { warehouse: { select: { id: true, name: true, isActive: true } } },
            },
          },
        },
      },
    });
    if (!p) throw new HttpError(404, "PRODUCT_NOT_FOUND");
    return p;
  });

  app.post("/products", async (req, reply) => {
    const b = ProductCreate.parse(req.body);
    if (!await prisma.productUnit.findFirst({ where: { name: b.unit, isActive: true } })) throw new HttpError(400, "INVALID_UNIT", "وحدة المنتج غير معرفة أو متوقفة");
    const actorId = actor(req);

    const product = await prisma.$transaction(async (tx) => {
      // 1. Create product
      const prod = await tx.product.create({
        data: {
          categoryId: b.categoryId,
          name: b.name.trim().normalize("NFC"),
          description: b.description?.trim().normalize("NFC") ?? null,
          imageUrl: b.imageUrl?.trim() ?? null,
          basePrice: b.basePrice,
          unit: b.unit,
          piecesPerUnit: b.piecesPerUnit,
        },
      });

      // 2. Default variant
      const variantLabel = (b.variantLabel?.trim() || "الأساسي").normalize("NFC");
      const autoSku = b.sku?.trim() || `SKU-${prod.id}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

      const variant = await tx.productVariant.create({
        data: {
          productId: prod.id,
          sku: autoSku,
          label: variantLabel,
          priceDelta: "0",
        },
      });

      // 3. Connect Stock Level and Initial Stock
      let targetWhId = b.warehouseId;
      if (!targetWhId) {
        const firstWh = await tx.warehouse.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
        if (firstWh) targetWhId = firstWh.id;
      }

      if (targetWhId) {
        const initialQty = b.initialStock ?? 0;
        await tx.stockLevel.create({
          data: {
            variantId: variant.id,
            warehouseId: targetWhId,
            onHand: initialQty,
            reserved: 0,
          },
        });

        if (initialQty > 0) {
          await tx.stockMovement.create({
            data: {
              variantId: variant.id,
              warehouseId: targetWhId,
              type: "receipt",
              qty: initialQty,
              refType: "manual",
              note: "رصيد افتتاحي عند إنشاء المنتج",
              createdBy: actorId,
            },
          });
        }

        // Initialize 0 stock for other active warehouses so it appears in all warehouses
        const otherWhs = await tx.warehouse.findMany({
          where: { isActive: true, id: { not: targetWhId } },
          select: { id: true },
        });
        for (const o of otherWhs) {
          await tx.stockLevel.create({
            data: {
              variantId: variant.id,
              warehouseId: o.id,
              onHand: 0,
              reserved: 0,
            },
          });
        }
      }

      return tx.product.findUniqueOrThrow({
        where: { id: prod.id },
        include: {
          category: true,
          variants: {
            include: {
              stockLevels: {
                include: { warehouse: { select: { id: true, name: true, isActive: true } } },
              },
            },
          },
        },
      });
    });

    await audit(actorId, "product.create", "product", product.id, b, req.ip);
    return reply.code(201).send(product);
  });

  app.patch("/products/:id", async (req) => {
    const { id } = IdParam.parse(req.params);
    const data = ProductUpdate.parse(req.body);
    if (data.unit && !await prisma.productUnit.findFirst({ where: { name: data.unit, isActive: true } })) throw new HttpError(400, "INVALID_UNIT", "وحدة المنتج غير معرفة أو متوقفة");
    const actorId = actor(req);
    const before = await prisma.product.findUnique({ where: { id }, select: { basePrice: true } });
    if (!before) throw new HttpError(404, "PRODUCT_NOT_FOUND");

    // Extract stock-related fields before updating the product
    const { warehouseId: stockWhId, stockAdjust, ...productData } = data;

    const row = await prisma.product.update({ where: { id }, data: productData });
    const meta: Record<string, unknown> = { ...productData };
    if (productData.basePrice !== undefined) meta.oldBasePrice = before.basePrice.toFixed(2);
    await audit(actorId, productData.basePrice !== undefined ? "product.price_change" : "product.update", "product", id, meta, req.ip);

    // If stockAdjust is provided, apply it to all variants of this product in the given warehouse
    if (stockAdjust !== undefined && stockAdjust !== 0 && stockWhId) {
      const wh = await prisma.warehouse.findUnique({ where: { id: stockWhId }, select: { isActive: true } });
      if (wh?.isActive) {
        const variants = await prisma.productVariant.findMany({ where: { productId: id }, select: { id: true } });
        for (const v of variants) {
          // Ensure stock level row exists
          const ex = await prisma.stockLevel.findUnique({
            where: { variantId_warehouseId: { variantId: v.id, warehouseId: stockWhId } },
            select: { variantId: true },
          });
          if (!ex) {
            await prisma.stockLevel.create({ data: { variantId: v.id, warehouseId: stockWhId, onHand: 0, reserved: 0 } });
          }
          // Atomic update
          await prisma.$executeRaw`
            UPDATE stock_levels SET on_hand = on_hand + ${stockAdjust}
            WHERE variant_id = ${v.id} AND warehouse_id = ${stockWhId}
              AND on_hand + ${stockAdjust} >= reserved`;
          await prisma.stockMovement.create({
            data: {
              variantId: v.id,
              warehouseId: stockWhId,
              type: stockAdjust > 0 ? "receipt" : "adjustment",
              qty: stockAdjust,
              refType: "manual",
              note: "تعديل من شاشة بيانات المنتج",
              createdBy: actorId,
            },
          });
        }
      }
    }

    return row;
  });

  const hardDeleteProduct = async (id: bigint, actorId: bigint, ip?: string) => {
    const existing = await prisma.product.findUnique({
      where: { id },
      include: { variants: { select: { id: true } } },
    });
    if (!existing) throw new HttpError(404, "PRODUCT_NOT_FOUND", "المنتج غير موجود");

    await prisma.$transaction(async (tx) => {
      const variantIds = existing.variants.map((v) => v.id);
      if (variantIds.length > 0) {
        await tx.orderItem.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.reservation.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.stockMovement.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.stockLevel.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.productVariant.deleteMany({ where: { id: { in: variantIds } } });
      }
      await tx.discount.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });

      const emptyOrders = await tx.order.findMany({ where: { items: { none: {} } }, select: { id: true } });
      if (emptyOrders.length > 0) {
        const emptyOrderIds = emptyOrders.map((o) => o.id);
        await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: emptyOrderIds } } });
        await tx.reservation.deleteMany({ where: { orderId: { in: emptyOrderIds } } });
        await tx.order.deleteMany({ where: { id: { in: emptyOrderIds } } });
      }
    });

    await audit(actorId, "product.force_delete", "product", id, { name: existing.name }, ip);
  };

  app.delete("/products/:id/force", async (req, reply) => {
    const { id } = IdParam.parse(req.params);
    await hardDeleteProduct(id, actor(req), req.ip);
    return reply.code(204).send();
  });

  app.delete("/products/:id", async (req, reply) => {
    const { id } = IdParam.parse(req.params);
    const isHard = (req.query as { hard?: string })?.hard === "true";
    if (isHard) {
      await hardDeleteProduct(id, actor(req), req.ip);
      return reply.code(204).send();
    }
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    await audit(actor(req), "product.deactivate", "product", id, undefined, req.ip);
    return reply.code(204).send();
  });

  // ---------- variants ----------
  app.post("/variants", async (req, reply) => {
    const b = VariantCreate.parse(req.body);
    const actorId = actor(req);

    const row = await prisma.$transaction(async (tx) => {
      const autoSku = b.sku?.trim() || `SKU-${b.productId}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      const variant = await tx.productVariant.create({
        data: {
          productId: b.productId,
          sku: autoSku,
          label: b.label.trim().normalize("NFC"),
          priceDelta: b.priceDelta,
        },
      });

      let targetWhId = b.warehouseId;
      if (!targetWhId) {
        const firstWh = await tx.warehouse.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
        if (firstWh) targetWhId = firstWh.id;
      }

      if (targetWhId) {
        const initialQty = b.initialStock ?? 0;
        await tx.stockLevel.create({
          data: {
            variantId: variant.id,
            warehouseId: targetWhId,
            onHand: initialQty,
            reserved: 0,
          },
        });

        if (initialQty > 0) {
          await tx.stockMovement.create({
            data: {
              variantId: variant.id,
              warehouseId: targetWhId,
              type: "receipt",
              qty: initialQty,
              refType: "manual",
              note: "رصيد افتتاحي عند إضافة المقاس",
              createdBy: actorId,
            },
          });
        }

        const otherWhs = await tx.warehouse.findMany({
          where: { isActive: true, id: { not: targetWhId } },
          select: { id: true },
        });
        for (const o of otherWhs) {
          await tx.stockLevel.create({
            data: {
              variantId: variant.id,
              warehouseId: o.id,
              onHand: 0,
              reserved: 0,
            },
          });
        }
      }

      return tx.productVariant.findUniqueOrThrow({
        where: { id: variant.id },
        include: {
          stockLevels: {
            include: { warehouse: { select: { id: true, name: true, isActive: true } } },
          },
        },
      });
    });

    await audit(actorId, "variant.create", "variant", row.id, b, req.ip);
    return reply.code(201).send(row);
  });

  app.patch("/variants/:id", async (req) => {
    const { id } = IdParam.parse(req.params);
    const data = VariantUpdate.parse(req.body);
    const row = await prisma.productVariant.update({ where: { id }, data });
    await audit(actor(req), data.priceDelta !== undefined ? "variant.price_change" : "variant.update", "variant", id, data, req.ip);
    return row;
  });

  // Ensure stock level rows exist for ALL active warehouses for a given variant
  app.post("/variants/:id/ensure-stock", async (req, reply) => {
    const { id } = IdParam.parse(req.params);
    const variant = await prisma.productVariant.findUnique({ where: { id }, select: { id: true } });
    if (!variant) throw new HttpError(404, "VARIANT_NOT_FOUND");
    const whs = await prisma.warehouse.findMany({ where: { isActive: true }, select: { id: true } });
    for (const wh of whs) {
      const ex = await prisma.stockLevel.findUnique({
        where: { variantId_warehouseId: { variantId: id, warehouseId: wh.id } },
        select: { variantId: true },
      });
      if (!ex) {
        try {
          await prisma.stockLevel.create({ data: { variantId: id, warehouseId: wh.id, onHand: 0, reserved: 0 } });
        } catch {
          // race condition: already created
        }
      }
    }
    return reply.code(200).send({ ok: true });
  });

  app.delete("/variants/:id", async (req, reply) => {
    const { id } = IdParam.parse(req.params);
    await prisma.productVariant.update({ where: { id }, data: { isActive: false } });
    await audit(actor(req), "variant.deactivate", "variant", id, undefined, req.ip);
    return reply.code(204).send();
  });

  // ---------- warehouses ----------
  app.get("/warehouses", async () => prisma.warehouse.findMany({ orderBy: { id: "asc" } }));

  app.post("/warehouses", async (req, reply) => {
    const b = WarehouseCreate.parse(req.body);
    const row = await prisma.warehouse.create({ data: b });
    await audit(actor(req), "warehouse.create", "warehouse", row.id, b, req.ip);
    return reply.code(201).send(row);
  });

  app.patch("/warehouses/:id", async (req) => {
    const { id } = IntIdParam.parse(req.params);
    const data = WarehouseUpdate.parse(req.body);
    const row = await prisma.warehouse.update({ where: { id }, data });
    await audit(actor(req), "warehouse.update", "warehouse", id, data, req.ip);
    return row;
  });

  const hardDeleteWarehouse = async (id: number, actorId: bigint, ip?: string) => {
    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "WAREHOUSE_NOT_FOUND", "المخزن غير موجود");

    await prisma.$transaction(async (tx) => {
      await tx.reservation.deleteMany({ where: { warehouseId: id } });
      await tx.stockMovement.deleteMany({ where: { warehouseId: id } });
      await tx.stockLevel.deleteMany({ where: { warehouseId: id } });
      const orderCount = await tx.order.count({ where: { warehouseId: id } });
      if (orderCount > 0) {
        throw new HttpError(400, "WAREHOUSE_HAS_ORDERS", "لا يمكن حذف المخزن لوجود طلبات مرتبطة به، يرجى تعطيله بدلاً من ذلك");
      }
      await tx.warehouse.delete({ where: { id } });
    });

    await audit(actorId, "warehouse.force_delete", "warehouse", id, { name: existing.name }, ip);
  };

  app.delete("/warehouses/:id/force", async (req, reply) => {
    const { id } = IntIdParam.parse(req.params);
    await hardDeleteWarehouse(id, actor(req), req.ip);
    return reply.code(204).send();
  });

  app.delete("/warehouses/:id", async (req, reply) => {
    const { id } = IntIdParam.parse(req.params);
    const isHard = (req.query as { hard?: string })?.hard === "true";
    if (isHard) {
      await hardDeleteWarehouse(id, actor(req), req.ip);
      return reply.code(204).send();
    }
    await prisma.warehouse.update({ where: { id }, data: { isActive: false } });
    await audit(actor(req), "warehouse.deactivate", "warehouse", id, undefined, req.ip);
    return reply.code(204).send();
  });
};

export default adminCatalogRoutes;
