const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DOCS_DIR = path.resolve(__dirname, '../../docs');
const GIFSHOT_PATH = path.resolve(__dirname, '../node_modules/gifshot/dist/gifshot.js');

async function main() {
  console.log('Launching headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: {
      width: 1440,
      height: 960,
      deviceScaleFactor: 2, // Hi-DPI retina screenshots
    },
  });

  const page = await browser.newPage();
  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#root');
  await new Promise((r) => setTimeout(r, 1000));

  // --- SECTION 1: PLAYGROUND ---
  console.log('Exercising Section 1: Playground...');
  // Click Send 1 Req
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent.includes('Send 1 Req'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent.includes('Send 1 Req'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // Click Burst
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent.includes('Burst'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Capture Playground Screenshot
  const playgroundPath = path.join(DOCS_DIR, 'dashboard-playground.png');
  await page.screenshot({ path: playgroundPath, fullPage: true });
  console.log(`Saved Playground screenshot to: ${playgroundPath}`);

  // --- SECTION 2: ALGORITHM COMPARISON ---
  console.log('Exercising Section 2: Algorithm Comparison...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const tab = buttons.find((b) => b.textContent.includes('Algorithm Comparison'));
    if (tab) tab.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  console.log('Triggering Window-Boundary Burst Comparison...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent.includes('Run Comparison'));
    if (btn) btn.click();
  });

  const frames = [];
  // Capture sequence of frames for GIF (every 250ms for ~8 seconds)
  const startTime = Date.now();
  while (Date.now() - startTime < 8500) {
    const buffer = await page.screenshot({ type: 'png' });
    frames.push('data:image/png;base64,' + buffer.toString('base64'));
    await new Promise((r) => setTimeout(r, 250));
  }

  // Capture static high-res comparison screenshot
  const comparisonPath = path.join(DOCS_DIR, 'dashboard-comparison.png');
  await page.screenshot({ path: comparisonPath, fullPage: true });
  console.log(`Saved Comparison screenshot to: ${comparisonPath}`);

  // Generate GIF inside browser context
  if (frames.length > 5 && fs.existsSync(GIFSHOT_PATH)) {
    console.log(`Injecting gifshot into browser page and generating GIF from ${frames.length} frames...`);
    await page.addScriptTag({ path: GIFSHOT_PATH });

    const gifDataUrl = await page.evaluate(async (imgList) => {
      return new Promise((resolve) => {
        window.gifshot.createGIF(
          {
            images: imgList,
            interval: 0.25,
            gifWidth: 720,
            gifHeight: 480,
            sampleInterval: 10,
            numWorkers: 2,
          },
          (obj) => {
            if (!obj.error) {
              resolve(obj.image);
            } else {
              console.error(obj.error);
              resolve(null);
            }
          }
        );
      });
    }, frames);

    if (gifDataUrl) {
      const base64Data = gifDataUrl.replace(/^data:image\/gif;base64,/, '');
      const gifPath = path.join(DOCS_DIR, 'boundary-burst.gif');
      fs.writeFileSync(gifPath, base64Data, 'base64');
      console.log(`Saved animated GIF to: ${gifPath}`);
    }
  }

  // --- SECTION 3: CLUSTER OBSERVABILITY ---
  console.log('Exercising Section 3: Cluster Observability...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const tab = buttons.find((b) => b.textContent.includes('Cluster Observability'));
    if (tab) tab.click();
  });
  await new Promise((r) => setTimeout(r, 2500)); // allow prometheus poll

  const statusPath = path.join(DOCS_DIR, 'dashboard-status.png');
  await page.screenshot({ path: statusPath, fullPage: true });
  console.log(`Saved Status screenshot to: ${statusPath}`);

  await browser.close();
  console.log('Browser automation and visual captures completed successfully!');
}

main().catch((err) => {
  console.error('Error in capture script:', err);
  process.exit(1);
});
