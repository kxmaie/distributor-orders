import { PrismaClient } from "@prisma/client";
import { currentTenant } from "./tenant-context";

const defaultClient = new PrismaClient();

/** Existing modules transparently use the tenant database selected for this request. */
export const prisma = new Proxy(defaultClient, {
  get(_target, property) {
    const client = currentTenant()?.client ?? defaultClient;
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;
