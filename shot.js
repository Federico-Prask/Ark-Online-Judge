const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1.5 });
  await page.goto('file:///home/user/arkoj-home.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: '/home/user/shot-out.png', fullPage: false });
  await page.evaluate(() => setLogin(true));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: '/home/user/shot-in.png', fullPage: false });
  // full page of logged-in state
  await page.screenshot({ path: '/home/user/shot-in-full.png', fullPage: true });
  await browser.close();
  console.log('ok');
})();
