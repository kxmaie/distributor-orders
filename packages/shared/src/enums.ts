// DB enums don't exist on SQL Server; the values live here and are enforced by
// Zod at the API boundary and by CHECK constraints in the database.
export const ORDER_STATUSES = ["new", "confirmed", "in_production", "ready", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const UNITS = ["piece", "meter", "sqm"] as const;
export type Unit = (typeof UNITS)[number];

export const MOVEMENT_TYPES = ["receipt", "adjustment", "reserve", "release", "ship"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const RESERVATION_STATUSES = ["active", "released", "fulfilled"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const PASSWORD_REQUEST_STATUSES = ["pending", "resolved", "rejected"] as const;
export type PasswordRequestStatus = (typeof PASSWORD_REQUEST_STATUSES)[number];

export const NOTIF_CHANNELS = ["whatsapp", "in_app"] as const;
export type NotifChannel = (typeof NOTIF_CHANNELS)[number];

export const QUEUE_STATUSES = ["pending", "sent", "failed"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];
