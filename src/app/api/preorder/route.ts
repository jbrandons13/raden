import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { verifyPassword } from '@/lib/preorderAuth';

// Public branch pre-order API. Branches have NO Supabase session — they prove
// themselves with a per-branch password (verified server-side here), and all DB
// access goes through the service-role client. They can only ever see the
// catalog (branch prices) and create their own branch order.

// GET — list branches that have a pre-order password (for the login dropdown).
export async function GET() {
  const svc = createAdminClient();
  const { data, error } = await svc
    .from('customers')
    .select('id, name')
    .eq('type', 'branch')
    .not('preorder_password_hash', 'is', null)
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ branches: data ?? [] });
}

// POST — action 'catalog' (login + get products) or 'submit' (place a pre-order).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const branchId = String(body.branchId || '');
  const password = String(body.password || '');
  if (!branchId || !password) return NextResponse.json({ error: 'Branch & password wajib diisi.' }, { status: 400 });

  const svc = createAdminClient();
  const { data: branch } = await svc
    .from('customers')
    .select('id, name, type, preorder_password_hash')
    .eq('id', branchId)
    .eq('type', 'branch')
    .single();

  if (!branch || !verifyPassword(password, branch.preorder_password_hash)) {
    return NextResponse.json({ error: 'Branch atau password salah.' }, { status: 401 });
  }

  if (action === 'catalog') {
    const { data: products } = await svc
      .from('products')
      .select('id, name, price_branch, options')
      .eq('is_hot_kitchen', false)
      .order('sort_order', { ascending: true })
      .order('name');
    return NextResponse.json({ branchName: branch.name, products: products ?? [] });
  }

  if (action === 'submit') {
    const items = Array.isArray(body.items) ? body.items : [];
    const deliveryDate = String(body.deliveryDate || '').slice(0, 10);
    if (items.length === 0) return NextResponse.json({ error: 'Keranjang masih kosong.' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) return NextResponse.json({ error: 'Tanggal kirim tidak valid.' }, { status: 400 });

    // Re-price server-side — never trust totals/prices sent by the client.
    const { data: products } = await svc.from('products').select('id, price_branch').eq('is_hot_kitchen', false);
    const priceMap = new Map((products || []).map((p: any) => [p.id, Number(p.price_branch) || 0]));

    let total = 0;
    const rows: { product_id: string; qty: number; variant: string | null }[] = [];
    for (const it of items) {
      const pid = String(it.product_id || '');
      const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
      if (!priceMap.has(pid) || qty <= 0) continue;
      total += qty * (priceMap.get(pid) as number);
      rows.push({ product_id: pid, qty, variant: it.variant ? String(it.variant) : null });
    }
    if (rows.length === 0) return NextResponse.json({ error: 'Tidak ada item yang valid.' }, { status: 400 });

    const { data: ord, error: oErr } = await svc.from('orders').insert({
      customer_id: branchId,
      channel: 'branch',
      order_date: deliveryDate,
      status: 'Draft',
      total_revenue: total,
      is_preorder: true,
    }).select('id').single();
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

    const { error: iErr } = await svc.from('order_items').insert(rows.map((r) => ({ ...r, order_id: ord.id })));
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, total });
  }

  return NextResponse.json({ error: 'Action tidak dikenal.' }, { status: 400 });
}
