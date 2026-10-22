import { randomBytes } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

// OWASP-recommended argon2id baseline (same params as the old native argon2 module)
const MEMORY = 19456;
const ITERATIONS = 2;
const PARALLELISM = 1;
const HASH_LENGTH = 32;
const SALT_LENGTH = 16;

export const hashPassword = (pw: string) =>
  argon2id({
    password: pw,
    salt: randomBytes(SALT_LENGTH),
    parallelism: PARALLELISM,
    iterations: ITERATIONS,
    memorySize: MEMORY,
    hashLength: HASH_LENGTH,
    outputType: "encoded",
  });

export const verifyPassword = async (hash: string, pw: string) => {
  try {
    return await argon2Verify({ password: pw, hash });
  } catch {
    return false;
  }
};

// Keeps timing similar when the username doesn't exist
let dummy: Promise<string> | undefined;
export const dummyVerify = async (pw: string) => {
  dummy ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(await dummy, pw);
};
