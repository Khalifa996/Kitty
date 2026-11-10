// Photographs each screen of the browser build with made-up sample data.
// Usage: node shots.mjs <web build dir> <output dir>
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [webDir, outDir] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(outDir, { recursive: true });
const NOW = new Date('2026-10-29T12:00:00');
const state = readFileSync(join(here, 'sample-state.json'), 'utf8');
const alerts = JSON.parse(readFileSync(join(here, 'sample-alerts.json'), 'utf8'))
  .map((a, i) => ({ key: `demo${i}`, pkg: a.pkg, title: a.title, text: a.text, time: NOW.getTime() - a.ago * 60000 }));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const server = createServer((req, res) => {
  let p = join(webDir, decodeURIComponent((req.url || '/').split('?')[0]));
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(webDir, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(8099);

const errors = [];
const browser = await chromium.launch();
async function session(name, seed, steps) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.clock.setFixedTime(NOW);
  if (seed) await ctx.addInitScript(([s, a]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('kitty.v1', s); localStorage.setItem('kitty.demoAlerts', a); sessionStorage.setItem('seeded', '1'); } }, [state, JSON.stringify(alerts)]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.goto('http://localhost:8099/');
  await page.waitForTimeout(2500);
  for (const [shot, act] of steps) {
    try { if (act) await act(page); await page.waitForTimeout(600); } catch (e) { errors.push(`${name}/${shot}: ${e.message.split('\n')[0]}`); }
    await page.screenshot({ path: join(outDir, `${shot}.png`) });
  }
  await ctx.close();
}
const tab = (label) => (p) => p.getByLabel(`${label} tab`).click();

const btn = (name) => (p) => p.getByRole('button', { name, exact: true }).click();
await session('fresh', false, [
  ['0-first-open', null],
  ['0a-setup-pay', btn('Get started')],
  ['0b-setup-income', async (p) => { await btn('Next')(p); await p.getByLabel('Take-home pay').fill('1850'); }],
  ['0c-setup-bills', async (p) => { await btn('Next')(p); await p.getByLabel('Rent or mortgage amount').fill('750'); await p.getByLabel('Mobile phone amount').fill('18'); }],
  ['0d-setup-save', async (p) => { await btn('Next')(p); await p.getByLabel('Savings each payday').fill('100'); await p.getByLabel('Money you have now').fill('1600'); }],
  ['0e-setup-done', btn('Start using Crest')],
]);
await session('sample', true, [
  ['1-log', null],
  ['2-log-typing', async (p) => { for (const k of ['4', '.', '5', '0']) await p.getByLabel(k === '.' ? 'Decimal point' : k, { exact: true }).click(); await p.getByLabel('Where').fill('Pret'); }],
  ['3-review', tab('Review')],
  ['3b-review-make-bill', async (p) => { await btn('Make it a bill')(p); await p.getByLabel('Bill name').fill('TV licence'); }],
  ['3c-review-bill-added', btn('Add to my bills')],
  ['4-review-added', (p) => p.getByRole('button', { name: 'Add', exact: true }).first().click()],
  ['5-review-skipped', (p) => p.getByLabel('Show skipped').click()],
  ['5b-review-notices', async (p) => { await p.getByLabel('Show notices').click(); await p.mouse.wheel(0, 600); }],
  ['6-activity', tab('Activity')],
  ['8-insights-day', tab('Insights')],
  ['9-insights-month', (p) => p.getByText('Pay month', { exact: true }).click()],
  ['9e-insights-pace', (p) => p.getByText(/usual pace|first week of the pay month/).first().scrollIntoViewIfNeeded()],
  ['9a-insights-where', (p) => p.getByText('Where it went', { exact: true }).scrollIntoViewIfNeeded()],
  ['9b-insights-shops', async (p) => { await btn('Shops')(p); await p.getByText('Where it went', { exact: true }).scrollIntoViewIfNeeded(); }],
  ['9c-insights-category', async (p) => { await btn('Categories')(p); await p.getByRole('button', { name: /^Eating out: / }).first().click(); }],
  ['9d-insights-category-more', (p) => p.mouse.wheel(0, 500)],
  ['9f-ask', async (p) => { await p.getByLabel('Close', { exact: true }).first().click({ timeout: 3000 }).catch(() => {}); await p.mouse.wheel(0, -3000); await btn('Ask Crest')(p); }],
  ['7-plan', async (p) => { await p.getByLabel('Close', { exact: true }).first().click({ timeout: 3000 }).catch(() => {}); await tab('Plan')(p); }],
  ['7a-plan-debts', btn('Debts')],
  ['7a2-plan-debts-more', (p) => p.getByText('Cards and loans', { exact: true }).scrollIntoViewIfNeeded()],
  ['7b-pots', (p) => p.getByText('Pots', { exact: true }).click()],
  ['7c-more', (p) => p.getByLabel('Settings and backups').click()],
  ['1b-log-date', async (p) => { await tab('Log')(p); await p.getByLabel(/^Date:/).click(); }],
]);
writeFileSync(join(outDir, 'errors.txt'), errors.join('\n') || 'none');
console.log('screenshots done; errors:', errors.length ? '\n' + errors.join('\n') : 'none');
await browser.close();
server.close();
