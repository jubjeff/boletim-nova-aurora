const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  console.log('Carregando:', fileUrl);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files']
  });
  const page = await browser.newPage();

  // Captura erros do console da página para debug
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });

  // Espera o x-dc renderizar (mesmo critério do waitForContent do app)
  await page.waitForFunction(() => {
    const inner = document.getElementById('sheet-inner');
    return inner && inner.scrollHeight > 100;
  }, { timeout: 60000 });

  // Garante que as fontes terminaram de carregar
  await page.evaluate(() => document.fonts && document.fonts.ready);

  // Pequena folga para o layout estabilizar
  await new Promise(r => setTimeout(r, 800));

  // Mede a altura JÁ sob a mídia de impressão (com as compressões do
  // @media print aplicadas) para calcular a escala que faz tudo caber
  // em UMA página A4 (210x297mm = 794x1123px @96dpi).
  await page.emulateMediaType('print');
  const heightPx = await page.evaluate(() => {
    const inner = document.getElementById('sheet-inner');
    inner.style.transform = 'none';
    inner.style.zoom = '1';
    return Math.ceil(inner.scrollHeight);
  });
  const A4_H = 1123;
  const scale = Math.min(1, A4_H / heightPx);
  console.log('Altura do conteúdo:', heightPx, 'px | escala p/ A4:', scale.toFixed(3));

  // Captura PNG de prévia (para conferência visual)
  await page.screenshot({ path: 'boletim-preview.png', fullPage: true });

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
