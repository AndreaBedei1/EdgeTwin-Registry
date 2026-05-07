import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}
