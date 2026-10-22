"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_STATUSES = exports.NOTIF_CHANNELS = exports.PASSWORD_REQUEST_STATUSES = exports.RESERVATION_STATUSES = exports.MOVEMENT_TYPES = exports.UNITS = exports.ORDER_STATUSES = void 0;
// DB enums don't exist on SQL Server; the values live here and are enforced by
// Zod at the API boundary and by CHECK constraints in the database.
exports.ORDER_STATUSES = ["new", "confirmed", "in_production", "ready", "delivered", "cancelled"];
exports.UNITS = ["piece", "meter", "sqm"];
exports.MOVEMENT_TYPES = ["receipt", "adjustment", "reserve", "release", "ship"];
exports.RESERVATION_STATUSES = ["active", "released", "fulfilled"];
exports.PASSWORD_REQUEST_STATUSES = ["pending", "resolved", "rejected"];
exports.NOTIF_CHANNELS = ["whatsapp", "in_app"];
exports.QUEUE_STATUSES = ["pending", "sent", "failed"];
