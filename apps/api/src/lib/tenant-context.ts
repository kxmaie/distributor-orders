import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@prisma/client";

export type TenantContext = { id: string; slug: string; client: PrismaClient; release: () => void };
const storage = new AsyncLocalStorage<TenantContext>();

export const runWithTenant = <T>(tenant: TenantContext, callback: () => T): T => storage.run(tenant, callback);
export const currentTenant = () => storage.getStore();
