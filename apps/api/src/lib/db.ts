import { PrismaClient } from "@prisma/client";
import { currentTenant } from "./tenant-context";
import { config } from "../config";

const databaseUrl = config.DEMO_MODE ? config.DEMO_DATABASE_URL : config.DATABASE_URL;
if (!databaseUrl) throw new Error("Demo mode requires a separate DEMO_DATABASE_URL");
const defaultClient = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

/** Existing modules transparently use the tenant database selected for this request. */
export const prisma = new Proxy(defaultClient, {
  get(_target, property) {
    const client = currentTenant()?.client ?? defaultClient;
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;
