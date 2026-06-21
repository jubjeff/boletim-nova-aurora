const fs = require('fs');

const tpl = fs.readFileSync('_tpl.html', 'utf8');

// JSON.stringify e escapar < para evitar que o HTML parser feche o script prematuro
const jsonStr = JSON.stringify(tpl);
// Substituir < por < (como o bundler original faz)
let encoded = '';
for (let i = 0; i < jsonStr.length; i++) {
  if (jsonStr.charCodeAt(i) === 60) { // char code 60 = '<'
    encoded += '\\u003c';
  } else {
    encoded += jsonStr[i];
  }
}

// Verificar que não há mais < literais (exceto o " inicial e final)
const hasRawLt = encoded.split('').some((c, i) => c.charCodeAt(0) === 60);
console.log('Has raw < in encoded:', hasRawLt);
console.log('Encoded starts:', encoded.substring(0, 40));
console.log('Encoded ends:  ', encoded.substring(encoded.length - 40));

// Verificar que JSON.parse funciona
const parsed = JSON.parse(encoded);
console.log('JSON.parse OK, length:', parsed.length);

const files = [
  'index.html',
  'Boletim Nova Aurora - Standalone.html'
];

for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const lineEnding = html.includes('\r\n') ? '\r\n' : '\n';
  const lines = html.split(lineEnding);

  // Confirmar que L203 é a abertura e L205 é o fechamento
  if (!lines[203].includes('__bundler/template') || !lines[205].includes('</script>')) {
    console.error('ERRO: estrutura inesperada em', f);
    console.error('L203:', lines[203]);
    console.error('L205:', lines[205]);
    process.exit(1);
  }

  // L204 = apenas o conteúdo JSON (sem tags <script>)
  lines[204] = encoded;
  fs.writeFileSync(f, lines.join(lineEnding), 'utf8');
  console.log('Updated:', f, '- L204 length:', encoded.length);
}
