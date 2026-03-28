import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

function getPasswordPepper() {
  return process.env.PASSWORD_PEPPER ?? 'CHANGE_ME_PASSWORD_PEPPER';
}

function preHashPassword(password: string) {
  return createHash('sha256').update(`${password}${getPasswordPepper()}`).digest('hex');
}

export async function hashPassword(password: string) {
  const preHashed = preHashPassword(password);
  return bcrypt.hash(preHashed, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  const preHashed = preHashPassword(password);
  return bcrypt.compare(preHashed, passwordHash);
}
