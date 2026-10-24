"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AccountQuery: () => AccountQuery,
  AdminOrderListQuery: () => AdminOrderListQuery,
  AdminProductQuery: () => AdminProductQuery,
  CartItem: () => CartItem,
  CartPriceBody: () => CartPriceBody,
  CatalogListQuery: () => CatalogListQuery,
  CategoryCreate: () => CategoryCreate,
  CategoryUpdate: () => CategoryUpdate,
  CreateDeliveryBody: () => CreateDeliveryBody,
  CreateOrderBody: () => CreateOrderBody,
  CreatePaymentBody: () => CreatePaymentBody,
  DiscountCreate: () => DiscountCreate,
  DiscountListQuery: () => DiscountListQuery,
  DiscountUpdate: () => DiscountUpdate,
  IdParam: () => IdParam,
  IntIdParam: () => IntIdParam,
  LoginBody: () => LoginBody,
  MOVEMENT_TYPES: () => MOVEMENT_TYPES,
  Money: () => Money,
  MovementQuery: () => MovementQuery,
  NOTIF_CHANNELS: () => NOTIF_CHANNELS,
  ORDER_STATUSES: () => ORDER_STATUSES,
  ORDER_TRANSITIONS: () => ORDER_TRANSITIONS,
  OrderListQuery: () => OrderListQuery,
  PASSWORD_MIN_LENGTH: () => PASSWORD_MIN_LENGTH,
  PASSWORD_REQUEST_STATUSES: () => PASSWORD_REQUEST_STATUSES,
  PageQuery: () => PageQuery,
  PasswordRequestBody: () => PasswordRequestBody,
  PasswordRequestQuery: () => PasswordRequestQuery,
  PasswordResolveBody: () => PasswordResolveBody,
  Pct: () => Pct,
  ProductCreate: () => ProductCreate,
  ProductUpdate: () => ProductUpdate,
  PublicUser: () => PublicUser,
  QUEUE_STATUSES: () => QUEUE_STATUSES,
  RESERVATION_STATUSES: () => RESERVATION_STATUSES,
  RegisterBody: () => RegisterBody,
  ReportsQuery: () => ReportsQuery,
  RoleSchema: () => RoleSchema,
  SalesReportQuery: () => SalesReportQuery,
  SignedMoney: () => SignedMoney,
  StatusChangeBody: () => StatusChangeBody,
  StockAdjustBody: () => StockAdjustBody,
  StockListQuery: () => StockListQuery,
  StockThresholdBody: () => StockThresholdBody,
  UNITS: () => UNITS,
  UserApproveBody: () => UserApproveBody,
  UserCreate: () => UserCreate,
  UserListQuery: () => UserListQuery,
  UserUpdate: () => UserUpdate,
  VariantCreate: () => VariantCreate,
  VariantUpdate: () => VariantUpdate,
  WarehouseCreate: () => WarehouseCreate,
  WarehouseUpdate: () => WarehouseUpdate,
  WhatsAppConsentBody: () => WhatsAppConsentBody,
  canTransition: () => canTransition
});
module.exports = __toCommonJS(index_exports);

// src/auth.ts
var import_zod = require("zod");
var RoleSchema = import_zod.z.enum(["distributor", "admin", "super_admin"]);
var PASSWORD_MIN_LENGTH = 12;
var LoginBody = import_zod.z.object({
  username: import_zod.z.string().trim().min(3).max(60),
  password: import_zod.z.string().min(1).max(200)
});
var RegisterBody = import_zod.z.object({
  username: import_zod.z.string().trim().min(3).max(60),
  password: import_zod.z.string().min(PASSWORD_MIN_LENGTH).max(200),
  fullName: import_zod.z.string().trim().min(2).max(120),
  phone: import_zod.z.string().trim().min(5).max(20).optional()
});
var PasswordRequestBody = import_zod.z.object({
  username: import_zod.z.string().trim().min(3).max(60),
  note: import_zod.z.string().trim().max(255).optional()
});
var PublicUser = import_zod.z.object({
  id: import_zod.z.string(),
  username: import_zod.z.string(),
  fullName: import_zod.z.string(),
  phone: import_zod.z.string().nullable(),
  whatsappOptInAt: import_zod.z.string().nullable(),
  role: RoleSchema
});
var WhatsAppConsentBody = import_zod.z.object({ enabled: import_zod.z.boolean() });

// src/enums.ts
var ORDER_STATUSES = ["new", "confirmed", "ready", "delivered", "cancelled"];
var UNITS = ["piece", "meter", "sqm"];
var MOVEMENT_TYPES = ["receipt", "adjustment", "reserve", "release", "ship"];
var RESERVATION_STATUSES = ["active", "released", "fulfilled"];
var PASSWORD_REQUEST_STATUSES = ["pending", "resolved", "rejected"];
var NOTIF_CHANNELS = ["whatsapp", "in_app"];
var QUEUE_STATUSES = ["pending", "sent", "failed"];

// src/catalog.ts
var import_zod2 = require("zod");
var bigId = import_zod2.z.union([import_zod2.z.string().regex(/^\d+$/), import_zod2.z.number().int().positive()]).transform((v) => BigInt(v));
var IdParam = import_zod2.z.object({ id: import_zod2.z.string().regex(/^\d+$/).transform((v) => BigInt(v)) });
var IntIdParam = import_zod2.z.object({ id: import_zod2.z.coerce.number().int().positive() });
var Money = import_zod2.z.union([import_zod2.z.number(), import_zod2.z.string()]).transform((v) => String(v).trim()).refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v), "Invalid amount (max 2 decimals)");
var SignedMoney = import_zod2.z.union([import_zod2.z.number(), import_zod2.z.string()]).transform((v) => String(v).trim()).refine((v) => /^-?\d{1,10}(\.\d{1,2})?$/.test(v), "Invalid amount (max 2 decimals)");
var PageQuery = import_zod2.z.object({
  page: import_zod2.z.coerce.number().int().min(1).default(1),
  pageSize: import_zod2.z.coerce.number().int().min(1).max(100).default(20)
});
var slug = import_zod2.z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
var CatalogListQuery = PageQuery.extend({
  category: import_zod2.z.string().trim().max(120).optional(),
  // id or slug
  q: import_zod2.z.string().trim().max(100).optional()
});
var CategoryCreate = import_zod2.z.object({
  name: import_zod2.z.string().trim().min(1).max(100),
  slug: slug.optional(),
  sortOrder: import_zod2.z.number().int().default(0)
});
var CategoryUpdate = import_zod2.z.object({
  name: import_zod2.z.string().trim().min(1).max(100),
  slug,
  sortOrder: import_zod2.z.number().int(),
  isActive: import_zod2.z.boolean()
}).partial();
var ProductCreate = import_zod2.z.object({
  categoryId: import_zod2.z.number().int().positive(),
  name: import_zod2.z.string().trim().min(1).max(160),
  description: import_zod2.z.string().max(5e3).nullable().optional(),
  imageUrl: import_zod2.z.string().max(500).nullable().optional(),
  basePrice: Money,
  unit: import_zod2.z.string().trim().min(1).max(20).default("piece"),
  piecesPerUnit: import_zod2.z.coerce.number().int().min(1).max(1e5).default(1),
  warehouseId: import_zod2.z.coerce.number().int().positive().optional(),
  initialStock: import_zod2.z.coerce.number().int().min(0).max(1e6).optional(),
  sku: import_zod2.z.string().trim().max(60).optional(),
  variantLabel: import_zod2.z.string().trim().max(120).optional()
});
var ProductUpdate = import_zod2.z.object({
  categoryId: import_zod2.z.number().int().positive(),
  name: import_zod2.z.string().trim().min(1).max(160),
  description: import_zod2.z.string().max(5e3).nullable(),
  imageUrl: import_zod2.z.string().max(500).nullable(),
  basePrice: Money,
  unit: import_zod2.z.string().trim().min(1).max(20),
  piecesPerUnit: import_zod2.z.coerce.number().int().min(1).max(1e5),
  isActive: import_zod2.z.boolean(),
  warehouseId: import_zod2.z.coerce.number().int().positive().optional(),
  stockAdjust: import_zod2.z.coerce.number().int().optional()
}).partial();
var AdminProductQuery = PageQuery.extend({
  category: import_zod2.z.string().trim().max(120).optional(),
  q: import_zod2.z.string().trim().max(100).optional(),
  active: import_zod2.z.enum(["true", "false"]).optional()
});
var sku = import_zod2.z.string().regex(/^[A-Za-z0-9._-]{1,60}$/);
var VariantCreate = import_zod2.z.object({
  productId: bigId,
  sku: import_zod2.z.string().trim().min(1).max(60).optional(),
  label: import_zod2.z.string().trim().min(1).max(120),
  priceDelta: SignedMoney.default("0"),
  warehouseId: import_zod2.z.coerce.number().int().positive().optional(),
  initialStock: import_zod2.z.coerce.number().int().min(0).max(1e6).optional()
});
var VariantUpdate = import_zod2.z.object({
  sku,
  label: import_zod2.z.string().trim().min(1).max(120),
  priceDelta: SignedMoney,
  isActive: import_zod2.z.boolean()
}).partial();
var WarehouseCreate = import_zod2.z.object({ name: import_zod2.z.string().trim().min(1).max(80) });
var WarehouseUpdate = import_zod2.z.object({
  name: import_zod2.z.string().trim().min(1).max(80),
  isActive: import_zod2.z.boolean()
}).partial();
var StockAdjustBody = import_zod2.z.object({
  variantId: bigId,
  warehouseId: import_zod2.z.number().int().positive(),
  delta: import_zod2.z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 1e6, "delta must be non-zero, |delta| <= 1,000,000"),
  type: import_zod2.z.enum(["receipt", "adjustment"]).default("adjustment"),
  note: import_zod2.z.string().trim().max(255).optional()
});
var StockThresholdBody = import_zod2.z.object({
  variantId: bigId,
  warehouseId: import_zod2.z.number().int().positive(),
  threshold: import_zod2.z.number().int().min(0).max(1e6)
});
var StockListQuery = PageQuery.extend({
  warehouseId: import_zod2.z.coerce.number().int().positive().optional(),
  variantId: import_zod2.z.string().regex(/^\d+$/).transform((v) => BigInt(v)).optional(),
  q: import_zod2.z.string().trim().max(100).optional()
});
var MovementQuery = PageQuery.extend({
  warehouseId: import_zod2.z.coerce.number().int().positive().optional(),
  variantId: import_zod2.z.string().regex(/^\d+$/).transform((v) => BigInt(v)).optional(),
  type: import_zod2.z.enum(MOVEMENT_TYPES).optional()
});

// src/orders.ts
var import_zod3 = require("zod");
var ORDER_TRANSITIONS = {
  new: ["confirmed", "cancelled"],
  confirmed: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: [],
  cancelled: []
};
var canTransition = (from, to) => ORDER_TRANSITIONS[from].includes(to);
var BigIdSchema = import_zod3.z.union([import_zod3.z.string().regex(/^\d+$/), import_zod3.z.number().int().positive()]).transform((v) => BigInt(v));
var CartItem = import_zod3.z.object({
  variantId: BigIdSchema,
  qty: import_zod3.z.number().int().min(1).max(1e5)
});
var CartPriceBody = import_zod3.z.object({
  items: import_zod3.z.array(CartItem).min(1).max(50),
  warehouseId: import_zod3.z.number().int().positive().optional()
});
var CreateOrderBody = CartPriceBody.extend({
  notes: import_zod3.z.string().trim().max(1e3).optional()
});
var OrderListQuery = PageQuery.extend({
  status: import_zod3.z.enum(ORDER_STATUSES).optional()
});
var day = import_zod3.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");
var AdminOrderListQuery = OrderListQuery.extend({
  q: import_zod3.z.string().trim().max(100).optional(),
  userId: import_zod3.z.string().regex(/^\d+$/).transform((v) => BigInt(v)).optional(),
  from: day.optional(),
  to: day.optional()
  // inclusive
});
var StatusChangeBody = import_zod3.z.object({
  status: import_zod3.z.enum(ORDER_STATUSES),
  note: import_zod3.z.string().trim().max(255).optional()
});

// src/admin.ts
var import_zod4 = require("zod");
var Pct = import_zod4.z.union([import_zod4.z.number(), import_zod4.z.string()]).transform((v) => String(v).trim()).refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), "Invalid percent").refine((v) => Number(v) >= 0 && Number(v) <= 100, "Percent must be 0\u2013100");
var phone = import_zod4.z.union([import_zod4.z.string().trim().max(20), import_zod4.z.null()]).transform((v) => v === "" ? null : v);
var Password = import_zod4.z.string().min(PASSWORD_MIN_LENGTH).max(200);
var UserListQuery = PageQuery.extend({
  q: import_zod4.z.string().trim().max(100).optional(),
  role: RoleSchema.optional(),
  active: import_zod4.z.enum(["true", "false"]).optional(),
  pending: import_zod4.z.enum(["true", "false"]).optional()
});
var UserApproveBody = import_zod4.z.object({
  defaultDiscountPct: Pct.optional()
});
var UserCreate = import_zod4.z.object({
  username: import_zod4.z.string().trim().min(3).max(60),
  password: Password,
  fullName: import_zod4.z.string().trim().min(1).max(120),
  phone: phone.optional(),
  role: RoleSchema.default("distributor"),
  defaultDiscountPct: Pct.default("0")
});
var UserUpdate = import_zod4.z.object({
  fullName: import_zod4.z.string().trim().min(1).max(120),
  phone,
  role: RoleSchema,
  defaultDiscountPct: Pct,
  isActive: import_zod4.z.boolean(),
  password: Password,
  unlock: import_zod4.z.literal(true)
}).partial();
var PasswordRequestQuery = PageQuery.extend({
  status: import_zod4.z.enum(PASSWORD_REQUEST_STATUSES).optional()
});
var PasswordResolveBody = import_zod4.z.object({
  status: import_zod4.z.enum(["resolved", "rejected"]),
  newPassword: Password.optional()
}).superRefine((b, ctx) => {
  if (b.status === "resolved" && !b.newPassword) {
    ctx.addIssue({ code: "custom", path: ["newPassword"], message: "newPassword is required when resolving" });
  }
});
var optionalBig = import_zod4.z.union([import_zod4.z.string().regex(/^\d+$/), import_zod4.z.number().int().positive(), import_zod4.z.null()]).optional().transform((v) => v == null || v === void 0 ? null : BigInt(v));
var optionalInt = import_zod4.z.number().int().positive().nullable().optional();
var isoDate = import_zod4.z.string().trim().min(10).refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date");
var DiscountListQuery = PageQuery.extend({
  userId: import_zod4.z.string().regex(/^\d+$/).transform((v) => BigInt(v)).optional(),
  active: import_zod4.z.enum(["true", "false"]).optional()
});
var DiscountCreate = import_zod4.z.object({
  userId: optionalBig,
  categoryId: optionalInt,
  productId: optionalBig,
  pct: Pct,
  startsAt: isoDate.nullable().optional(),
  endsAt: isoDate.nullable().optional(),
  isActive: import_zod4.z.boolean().default(true)
});
var DiscountUpdate = DiscountCreate.partial();
var day2 = import_zod4.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");
var ReportsQuery = import_zod4.z.object({
  from: day2.optional(),
  to: day2.optional()
});

// src/reports.ts
var import_zod5 = require("zod");
var dayRegex = /^\d{4}-\d{2}-\d{2}$/;
var SalesReportQuery = import_zod5.z.object({
  from: import_zod5.z.string().regex(dayRegex, "use YYYY-MM-DD").optional(),
  to: import_zod5.z.string().regex(dayRegex, "use YYYY-MM-DD").optional()
});

// src/business.ts
var import_zod6 = require("zod");
var bigId2 = import_zod6.z.union([import_zod6.z.string().regex(/^\d+$/), import_zod6.z.number().int().positive()]).transform((v) => BigInt(v));
var Money2 = import_zod6.z.union([import_zod6.z.number(), import_zod6.z.string()]).transform(String).refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Invalid amount");
var CreateDeliveryBody = import_zod6.z.object({
  trackingNumber: import_zod6.z.string().trim().max(100).optional(),
  note: import_zod6.z.string().trim().max(500).optional(),
  items: import_zod6.z.array(import_zod6.z.object({ orderItemId: bigId2, qty: import_zod6.z.number().int().min(1).max(1e6) })).min(1).max(100)
});
var CreatePaymentBody = import_zod6.z.object({
  amount: Money2,
  method: import_zod6.z.enum(["cash", "bank_transfer", "check", "other"]),
  reference: import_zod6.z.string().trim().max(100).optional(),
  note: import_zod6.z.string().trim().max(500).optional()
});
var AccountQuery = import_zod6.z.object({
  from: import_zod6.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: import_zod6.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AccountQuery,
  AdminOrderListQuery,
  AdminProductQuery,
  CartItem,
  CartPriceBody,
  CatalogListQuery,
  CategoryCreate,
  CategoryUpdate,
  CreateDeliveryBody,
  CreateOrderBody,
  CreatePaymentBody,
  DiscountCreate,
  DiscountListQuery,
  DiscountUpdate,
  IdParam,
  IntIdParam,
  LoginBody,
  MOVEMENT_TYPES,
  Money,
  MovementQuery,
  NOTIF_CHANNELS,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  OrderListQuery,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUEST_STATUSES,
  PageQuery,
  PasswordRequestBody,
  PasswordRequestQuery,
  PasswordResolveBody,
  Pct,
  ProductCreate,
  ProductUpdate,
  PublicUser,
  QUEUE_STATUSES,
  RESERVATION_STATUSES,
  RegisterBody,
  ReportsQuery,
  RoleSchema,
  SalesReportQuery,
  SignedMoney,
  StatusChangeBody,
  StockAdjustBody,
  StockListQuery,
  StockThresholdBody,
  UNITS,
  UserApproveBody,
  UserCreate,
  UserListQuery,
  UserUpdate,
  VariantCreate,
  VariantUpdate,
  WarehouseCreate,
  WarehouseUpdate,
  WhatsAppConsentBody,
  canTransition
});
