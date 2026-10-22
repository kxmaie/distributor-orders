import { createHash, randomBytes, randomUUID } from "node:crypto";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newRefreshToken = () => randomBytes(48).toString("base64url");
export const newFamilyId = () => randomUUID();
