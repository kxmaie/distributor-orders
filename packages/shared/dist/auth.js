"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicUser = exports.PasswordRequestBody = exports.RegisterBody = exports.LoginBody = exports.PASSWORD_MIN_LENGTH = exports.RoleSchema = void 0;
const zod_1 = require("zod");
exports.RoleSchema = zod_1.z.enum(["distributor", "admin", "super_admin"]);
exports.PASSWORD_MIN_LENGTH = 12;
exports.LoginBody = zod_1.z.object({
    username: zod_1.z.string().trim().min(3).max(60),
    password: zod_1.z.string().min(1).max(200),
});
exports.RegisterBody = zod_1.z.object({
    username: zod_1.z.string().trim().min(3).max(60),
    password: zod_1.z.string().min(exports.PASSWORD_MIN_LENGTH).max(200),
    fullName: zod_1.z.string().trim().min(2).max(120),
    phone: zod_1.z.string().trim().min(5).max(20),
});
exports.PasswordRequestBody = zod_1.z.object({
    username: zod_1.z.string().trim().min(3).max(60),
    note: zod_1.z.string().trim().max(255).optional(),
});
exports.PublicUser = zod_1.z.object({
    id: zod_1.z.string(),
    username: zod_1.z.string(),
    fullName: zod_1.z.string(),
    role: exports.RoleSchema,
});
