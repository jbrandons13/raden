// SERVER-ONLY: hash + verify branch pre-order passwords (Node crypto, scrypt).
// Never import this from a client component.
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  try {
    const hash = Buffer.from(hashHex, 'hex');
    const test = scryptSync(pw, Buffer.from(saltHex, 'hex'), hash.length);
    return hash.length === test.length && timingSafeEqual(hash, test);
  } catch {
    return false;
  }
}
