import { chromium } from 'playwright';

const MOCK = `Object.defineProperty(navigator,"credentials",{value:{create:async()=>({id:"m",rawId:new Uint8Array(32).fill(1).buffer,type:"public-key",response:{getPublicKey:()=>new Uint8Array(65).fill(4).buffer,clientDataJSON:new ArrayBuffer(0),attestationObject:new ArrayBuffer(0),getAuthenticatorData:()=>new ArrayBuffer(37),getTransports:()=>["internal"]},authenticatorAttachment:"platform",getClientExtensionResults:()=>({prf:{enabled:true,results:{first:new Uint8Array(32).fill(171).buffer}}})}),get:async()=>({id:"m",rawId:new Uint8Array(32).fill(1).buffer,type:"public-key",response:{clientDataJSON:new ArrayBuffer(0),authenticatorData:new ArrayBuffer(37),signature:new ArrayBuffer(64)},authenticatorAttachment:"platform",getClientExtensionResults:()=>({prf:{results:{first:new Uint8Array(32).fill(171).buffer}}})})},writable:false,configurable:true});`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();

await ctx.route('**/popup.html**', async (route) => {
  const resp = await route.fetch();
  const body = await resp.text();
  await route.fulfill({
    response: resp,
    body: body.replace('<div id="root">', `<script>${MOCK}<\/script><div id="root">`),
    headers: { ...resp.headers(), 'content-type': 'text/html' },
  });
});

const page = await ctx.newPage();
page.on('console', m => {
  const t = m.text();
  if (t.includes('PXEManager') || t.includes('RPCHandler') || t.includes('pxe:service') ||
      t.includes('pxe-worker') || t.includes('Registered') || t.includes('Started PXE') ||
      t.includes('Error') || t.includes('proc_exit') || t.includes('Worker'))
    console.log('[' + m.type() + ']', t.substring(0, 400));
});
page.on('pageerror', e => console.log('[ERR]', e.message.substring(0, 400)));

await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
await page.locator('button').filter({ hasText: /Passkey Wallet/i }).first().click();
await page.waitForTimeout(500);
await page.locator('[data-testid="passkey-connect-button"]').click();
console.log('Connect clicked — cross-origin (:3000 → :3001) with PXE Worker');

for (let i = 0; i < 36; i++) {
  await page.waitForTimeout(5000);
  const C = await page.locator('[data-testid="passkey-status-connected"]').isVisible().catch(() => false);
  const c = await page.locator('[data-testid="passkey-status-connecting"]').isVisible().catch(() => false);
  process.stdout.write((i + 1) * 5 + 's:' + c + '/' + C + ' ');
  if (C) {
    const a = await page.locator('[data-testid="passkey-address-value"]').textContent().catch(() => '?');
    console.log('\n');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   CROSS-ORIGIN CONNECTED!                ║');
    console.log('║   Address: ' + a?.substring(0, 30) + '...  ║');
    console.log('║   Dapp:    localhost:3000                 ║');
    console.log('║   Host:    localhost:3001 (cross-origin)  ║');
    console.log('║   PXE:     Worker (SharedArrayBuffer ✓)  ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    break;
  }
  if (!c && !C && i > 8) { console.log('\nLost state'); break; }
  console.log();
}

await browser.close();
