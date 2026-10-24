import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hashPassword } from "../src/lib/password";

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const password = await rl.question("Platform admin password (12+ characters): ");
    if (password.length < 12) throw new Error("Password must contain at least 12 characters");
    console.log("Set this value as the sensitive Vercel variable PLATFORM_ADMIN_PASSWORD_HASH:");
    console.log(await hashPassword(password));
  } finally { rl.close(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Could not hash password"); process.exitCode = 1; });
