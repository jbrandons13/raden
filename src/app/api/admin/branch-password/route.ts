import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { hashPassword } from '@/lib/preorderAuth';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Admin-only: set/clear a branch's pre-order password. Service-role bypasses RLS,
// so we first prove the caller is an authenticated admin (same as staff-accounts).
async function requireAdmin(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data: { user } } = await createClient(url, anonKey).auth.getUser(token);
  if (!user) return null;
  const svc = createAdminClient();
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin' ? svc : null;
}

// PATCH — { branchId, password }. Empty password clears it (disables pre-order).
export async function PATCH(req: Request) {
  const svc = await requireAdmin(req);
  if (!svc) return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const branchId = String(body.branchId || '');
  const password = String(body.password || '');
  if (!branchId) return NextResponse.json({ error: 'branchId wajib.' }, { status: 400 });
  if (password && password.length < 4) return NextResponse.json({ error: 'Password minimal 4 karakter.' }, { status: 400 });

  const hash = password ? hashPassword(password) : null;
  const { error } = await svc.from('customers').update({ preorder_password_hash: hash }).eq('id', branchId).eq('type', 'branch');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cleared: !password });
}
