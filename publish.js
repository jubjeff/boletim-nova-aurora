/**
 * publish.js
 * Lê boletim-content.json (exportado pelo botão "Publicar" no site),
 * injeta o conteúdo no Puppeteer, gera boletim.pdf e faz deploy.
 *
 * Uso: node publish.js
 */
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const CONTENT_FILE = path.join(__dirname, 'boletim-content.json');
const PDF_FILE     = path.join(__dirname, 'boletim.pdf');
const HTML_FILE    = 'file://' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

if (!fs.existsSync(CONTENT_FILE)) {
  console.error('❌  boletim-content.json não encontrado.');
  console.error('   Clique em "↑ Publicar" no site e mova o arquivo baixado para esta pasta.');
  process.exit(1);
}

const { html } = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
if (!html) { console.error('❌  Arquivo inválido.'); process.exit(1); }

(async () => {
  console.log('🚀  Abrindo boletim no Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });

  await page.goto(HTML_FILE, { waitUntil: 'networkidle0', timeout: 60000 });

  // Aguarda x-dc renderizar
  await page.waitForFunction(() => {
    const el = document.getElementById('sheet-inner');
    return el && el.scrollHeight > 100;
  }, { timeout: 60000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise(r => setTimeout(r, 600));

  // Injeta o conteúdo editado
  console.log('✏️   Injetando conteúdo editado...');
  await page.evaluate(function(editedHtml) {
    var inner = document.getElementById('sheet-inner');
    if (inner) inner.innerHTML = editedHtml;
  }, html);
  await new Promise(r => setTimeout(r, 400));

  // Mede sob mídia de impressão
  await page.emulateMediaType('print');
  const heightPx = await page.evaluate(() => {
    var inner = document.getElementById('sheet-inner');
    inner.style.transform = 'none';
    inner.style.zoom = '1';
    return Math.ceil(inner.scrollHeight);
  });
  const A4_H = 1123;
  const scale = Math.min(1, A4_H / heightPx);
  console.log('📐  Altura:', heightPx, 'px | escala:', scale.toFixed(3));

  await page.pdf({
    path: PDF_FILE,
    printBackground: true,
    format: 'A4',
    scale: scale,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    pageRanges: '1'
  });
  console.log('✅  boletim.pdf gerado.');
  await browser.close();

  // Commit e deploy
  console.log('📦  Commitando e fazendo deploy...');
  execSync('git add boletim.pdf', { stdio: 'inherit' });
  execSync('git commit -m "chore: publica boletim atualizado"', { stdio: 'inherit' });
  execSync('git push origin main', { stdio: 'inherit' });
  execSync('npx vercel --prod --yes', { stdio: 'inherit' });

  // Apaga o arquivo exportado após usar
  fs.unlinkSync(CONTENT_FILE);
  console.log('🎉  Publicado! O QR code já aponta para o boletim atualizado.');
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
