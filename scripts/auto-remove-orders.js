const { chromium } = require('playwright');

(async () => {
  const URL = 'http://localhost:3000/remove-orders.html';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  console.log('Opening', URL);
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });

  // Wait for input and buttons
  await page.waitForSelector('#orders', { timeout: 10000 });
  await page.waitForSelector('#backup', { timeout: 10000 });
  await page.waitForSelector('#run', { timeout: 10000 });

  // Click backup (downloads a file to the browser context; Playwright exposes download)
  const [download] = await Promise.all([
    page.waitForEvent('download').catch(() => null),
    page.click('#backup')
  ]);
  if (download) {
    const path = await download.path();
    console.log('Backup download available at:', path || '(path not exposed)');
  } else {
    console.log('Backup initiated (no download path available in this environment)');
  }

  // Click remove
  console.log('Triggering removal');
  await page.click('#run');

  // Wait a short while for script to complete
  await page.waitForTimeout(1500);

  // Capture console logs from the page for output
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  // Reload to ensure changes persisted
  await page.reload({ waitUntil: 'domcontentloaded' });

  console.log('Page console logs (last):');
  try {
    const content = await page.$eval('#out', el => el.innerText);
    console.log(content);
  } catch (e) {
    console.log('Could not read output from page:', e.message);
  }

  await browser.close();
  console.log('Done');
})();