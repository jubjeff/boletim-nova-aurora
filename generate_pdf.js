const puppeteer = require('puppeteer');
const path = require('path');
const fs   = require('fs');

(async () => {
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  const contentFile = path.join(__dirname, 'boletim-content.json');
  const editedHtml  = fs.existsSync(contentFile)
    ? JSON.parse(fs.readFileSync(contentFile, 'utf8')).html
    : null;

  if (editedHtml) console.log('Usando conteúdo de boletim-content.json');
  else            console.log('Usando conteúdo padrão do template');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });

  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });

  await page.waitForFunction(() => {
    const el = document.getElementById('sheet-inner');
    return el && el.scrollHeight > 100;
  }, { timeout: 60000 });

  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 600));

  // Injeta o conteúdo editado (se vier do boletim-content.json)
  if (editedHtml) {
    await page.evaluate(html => {
      const el = document.getElementById('sheet-inner');
      if (el) el.innerHTML = html;
    }, editedHtml);
    await new Promise(r => setTimeout(r, 400));
  }

  await page.emulateMediaType('print');
  const heightPx = await page.evaluate(() => {
    const el = document.getElementById('sheet-inner');
    el.style.transform = 'none';
    el.style.zoom = '1';
    return Math.ceil(el.scrollHeight);
  });
  const scale = Math.min(1, 1123 / heightPx);
  console.log('Altura:', heightPx, 'px | escala:', scale.toFixed(3));

  await page.pdf({
    path: 'boletim.pdf',
    printBackground: true,
    format: 'A4',
    scale: scale,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    pageRanges: '1'
  });

  console.log('PDF gerado: boletim.pdf');
  await browser.close();
})().catch(e => { console.error('ERRO:', e); process.exit(1); });
