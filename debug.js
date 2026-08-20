const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 160)); });
  page.on('response', (r) => { if (r.url().includes('/api/')) console.log('API', r.status(), r.url().replace('http://localhost:5173', '')); });
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto('http://localhost:5173/#/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 800));

  await page.goto('http://localhost:5173/#/login', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));
  await page.evaluate(() => {
    const set = (el, val) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(document.querySelector('input[placeholder="admin"]'), 'admin');
    set(document.querySelector('input[type="password"]'), 'admin123');
    document.querySelector('form button').click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  console.log('after login url:', page.url(), '| token:', await page.evaluate(() => (localStorage.getItem('arkoj-token') || '').slice(0, 8)));

  // 点 users-gear 进管理页
  const gear = await page.$('a[title="用户权限管理"]');
  console.log('gear visible:', !!gear);
  if (gear) { await gear.click(); await new Promise((r) => setTimeout(r, 1500)); }
  console.log('after gear url:', page.url(), '| token:', await page.evaluate(() => (localStorage.getItem('arkoj-token') || 'NONE').slice(0, 8)));
  const headerState = await page.evaluate(() => document.querySelector('header').innerText.replace(/\n/g, ' | ').slice(0, 200));
  console.log('header:', headerState);
  await browser.close();
})();
