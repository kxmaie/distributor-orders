"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesReportQuery = void 0;
const zod_1 = require("zod");
const dayRegex = /^\d{4}-\d{2}-\d{2}$/;
exports.SalesReportQuery = zod_1.z.object({
    from: zod_1.z.string().regex(dayRegex, "use YYYY-MM-DD").optional(),
    to: zod_1.z.string().regex(dayRegex, "use YYYY-MM-DD").optional(),
});
