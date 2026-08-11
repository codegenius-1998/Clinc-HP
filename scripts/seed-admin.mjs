// One-off helper: prints a D1 INSERT statement for a new user with a scrypt password hash matching
// src/lib/auth.ts. Usage: node scripts/seed-admin.mjs <email> <password> [admin|clinic_owner]
import { randomBytes, randomUUID, scryptSync } from "crypto";

const [, , email, password, role = "admin"] = process.argv;
if (!email || !password) {
  console.error("Usage: node scripts/seed-admin.mjs <email> <password> [admin|clinic_owner]");
  process.exit(1);
}
if (role !== "admin" && role !== "clinic_owner") {
  console.error(`Invalid role "${role}" — must be "admin" or "clinic_owner".`);
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
const id = randomUUID();

const sql = `INSERT INTO users (id, email, password_hash, password_salt, role) VALUES ('${id}', '${email}', '${hash}', '${salt}', '${role}');`;
console.log(sql);
