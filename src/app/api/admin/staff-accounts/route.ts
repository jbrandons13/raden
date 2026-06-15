import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { usernameToEmail, PIN_LENGTH } from '@/lib/auth';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type AdminCtx = { svc: SupabaseClient; callerId: string };
type AuthFail = { error: string; status: 401 | 403 };

/**
 * Gatekeeper: the service client bypasses RLS, so every handler must first
 * prove the CALLER is an authenticated admin. We validate the caller's JWT
 * (sent as a Bearer token) and check their role in `profiles`.
 */
async function requireAdmin(req: Request): Promise<AdminCtx | AuthFail> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'Tidak ada sesi.', status: 401 };

  const anon = createClient(url, anonKey);
  const { data: { user }, error } = await anon.auth.getUser(token);
  if (error || !user) return { error: 'Sesi tidak valid.', status: 401 };

  const svc = createAdminClient();
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return { error: 'Akses admin diperlukan.', status: 403 };

  return { svc, callerId: user.id };
}

// GET — list staff accounts
export async function GET(req: Request) {
  const ctx = await requireAdmin(req);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data, error } = await ctx.svc
    .from('profiles')
    .select('id, username, full_name, created_at')
    .eq('role', 'staff')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: data ?? [] });
}

// POST — create a staff account
export async function POST(req: Request) {
  const ctx = await requireAdmin(req);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await req.json().catch(() => ({}));
  const username = String(body.username || '').trim().toLowerCase();
  const pin = String(body.pin || '');
  const fullName = body.fullName ? String(body.fullName).trim() : null;

  if (!/^[a-z0-9_.]{3,}$/.test(username)) {
    return NextResponse.json({ error: 'Username minimal 3 karakter (huruf kecil/angka/titik/garis bawah).' }, { status: 400 });
  }
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
    return NextResponse.json({ error: `PIN harus tepat ${PIN_LENGTH} digit angka.` }, { status: 400 });
  }

  const { data: created, error: createErr } = await ctx.svc.auth.admin.createUser({
    email: usernameToEmail(username),
    password: pin,
    email_confirm: true,
    user_metadata: { username, full_name: fullName },
  });
  if (createErr || !created?.user) {
    const dup = /already|exists|registered/i.test(createErr?.message || '');
    return NextResponse.json({ error: dup ? 'Username sudah dipakai.' : (createErr?.message || 'Gagal membuat akun.') }, { status: 400 });
  }

  const { error: profErr } = await ctx.svc.from('profiles').insert({
    id: created.user.id,
    username,
    full_name: fullName,
    role: 'staff',
  });
  if (profErr) {
    // Avoid orphaned auth user if the profile insert fails.
    await ctx.svc.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: created.user.id, username });
}

// PATCH — reset a staff account's PIN ({ id, pin })
export async function PATCH(req: Request) {
  const ctx = await requireAdmin(req);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '');
  const pin = String(body.pin || '');
  if (!id) return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 });
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
    return NextResponse.json({ error: `PIN harus tepat ${PIN_LENGTH} digit angka.` }, { status: 400 });
  }

  // Only staff PINs may be reset through this endpoint (admins change their own).
  const { data: target } = await ctx.svc.from('profiles').select('role').eq('id', id).single();
  if (!target) return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
  if (target.role !== 'staff') {
    return NextResponse.json({ error: 'Hanya PIN akun staff yang bisa diubah di sini.' }, { status: 403 });
  }

  const { error } = await ctx.svc.auth.admin.updateUserById(id, { password: pin });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — remove a staff account ({ id })
export async function DELETE(req: Request) {
  const ctx = await requireAdmin(req);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 });

  // Only staff accounts may be removed through this endpoint.
  const { data: target } = await ctx.svc.from('profiles').select('role').eq('id', id).single();
  if (!target) return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
  if (target.role !== 'staff') {
    return NextResponse.json({ error: 'Hanya akun staff yang bisa dihapus di sini.' }, { status: 403 });
  }

  const { error } = await ctx.svc.auth.admin.deleteUser(id); // profiles row cascades (FK on delete cascade)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
