/**
 * Shared auth helpers — safe for BOTH client and server.
 * Must NOT contain any secrets (no service key here).
 */

export type AppRole = 'admin' | 'staff';

/**
 * Supabase Auth needs an email. Staff/admin only type a username + PIN,
 * so we map a username to a synthetic email behind the scenes.
 * These mailboxes never receive real email (accounts are created with
 * email_confirm = true), so the domain just needs to be stable & unique.
 */
export const AUTH_EMAIL_DOMAIN = 'raden.local';

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

/** Minimum PIN length (Supabase default password policy is 6). */
export const PIN_LENGTH = 6;
