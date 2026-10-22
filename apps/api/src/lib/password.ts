import argon2 from "argon2";

// OWASP-recommended argon2id baseline
const OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (pw: string) => argon2.hash(pw, OPTS);
export const verifyPassword = (hash: string, pw: string) => argon2.verify(hash, pw);

// Keeps timing similar when the username doesn't exist
let dummy: Promise<string> | undefined;
export const dummyVerify = async (pw: string) => {
  dummy ??= argon2.hash("dummy-password-for-timing", OPTS);
  await argon2.verify(await dummy, pw).catch(() => false);
};
