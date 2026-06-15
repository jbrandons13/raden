/**
 * Auto-capture README screenshots from the running app.
 *
 * Prereqs:
 *   1. Dev server running:  npm run dev   (http://localhost:3000)
 *   2. Playwright chromium:  npx playwright install chromium
 *
 * Usage (PIN is read from env so it never lands in git):
 *   SHOT_PIN=xxxxxx npm run screenshots
 *   SHOT_USER=admin1 SHOT_PIN=xxxxxx SHOT_BASE=http://localhost:3000 node scripts/screenshots.mjs
 *
 * Output: public/screenshots/*.png  (referenced by README.md)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOT_BASE || 'http://localhost:3000';
const USER = process.env.SHOT_USER || 'admin1';
const PIN = process.env.SHOT_PIN;
const OUT = 'public/screenshots';
// Optional: only capture these files (comma-separated). Login still happens.
const ONLY = (process.env.SHOT_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);

if (!PIN) {
  console.error('✗ Set SHOT_PIN (admin PIN). Example: SHOT_PIN=123456 npm run screenshots');
  process.exit(1);
}

// page path -> output filename (referenced in README.md)
const SHOTS = [
  { file: 'admin-dashboard', path: '/admin' },
  { file: 'products', path: '/admin/products' },
  { file: 'orders', path: '/admin/orders' },
  { file: 'branch-agent', path: '/admin/customers' },
  { file: 'expenses', path: '/admin/expenses' },
  { file: 'staff-shifts', path: '/admin/schedules' },
  { file: 'staff-jobdesk', path: '/staff' },
  { file: 'distribution', path: '/staff/orders' },
  { file: 'stock-check', path: '/staff/stock' },
  { file: 'checklist', path: '/staff/checklist' },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});

page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text()); });
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

const settle = (ms = 3000) => page.waitForTimeout(ms);

try {
  // 1) Login page (empty form) ------------------------------------------------
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await settle(1800);
  if (!ONLY.length || ONLY.includes('login')) {
    await page.screenshot({ path: `${OUT}/login.png` });
    console.log('✓ login');
  }

  // 2) Authenticate -----------------------------------------------------------
  await page.fill('input[autocomplete="username"]', USER);
  await page.fill('input[autocomplete="current-password"]', PIN);
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 8000 });
  await page.click('button[type="submit"]');
  // Login succeeds once supabase-js persists the session to localStorage.
  // (More robust than waiting on SPA navigation, which fires no 'load' event.)
  try {
    await page.waitForFunction(
      () => Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k)),
      undefined,
      { timeout: 20000 },
    );
  } catch {
    await page.screenshot({ path: `${OUT}/_debug-login.png` });
    const body = ((await page.textContent('body').catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 220);
    throw new Error('Login did not persist a session. Page said: ' + body);
  }
  await settle(2000);

  // 3) Walk the pages ---------------------------------------------------------
  const shots = ONLY.length ? SHOTS.filter((s) => ONLY.includes(s.file)) : SHOTS;
  for (const s of shots) {
    try {
      await page.goto(`${BASE}${s.path}`, { waitUntil: 'domcontentloaded' });
      await settle(3000); // let data fetch + animations settle
      await page.screenshot({ path: `${OUT}/${s.file}.png` });
      console.log('✓', s.file);
    } catch (err) {
      console.error('✗', s.file, '-', err.message);
    }
  }
} finally {
  await browser.close();
}

console.log('\nDone →', OUT);
