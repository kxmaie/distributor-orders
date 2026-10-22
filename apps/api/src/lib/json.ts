// SQL Server has no Prisma Json type: JSON is stored as NVarChar(Max) text.
// Prisma returns BigInt ids, which JSON.stringify rejects -> serialize them as strings globally.
// (Prisma.Decimal already has toJSON() -> string.)
declare global {
  interface BigInt {
    toJSON(): string;
  }
}
if (!(BigInt.prototype as { toJSON?: unknown }).toJSON) {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

export const toJson = (v: unknown): string => JSON.stringify(v);
export const fromJson = <T = unknown>(s: string | null | undefined): T | null =>
  s == null ? null : (JSON.parse(s) as T);
