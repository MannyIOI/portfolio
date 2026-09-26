// Renders tools/resume.html to assets/Amanuel-Teferi-Resume.pdf.
// Usage: node tools/build-resume.js   (requires the `playwright` package)
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, 'resume.html'));
  await page.pdf({
    path: path.join(__dirname, '..', 'assets', 'Amanuel-Teferi-Resume.pdf'),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();
})();
