// Confere se css/tailwind.css está em dia com as classes usadas em index.html e js/*.js.
// Recompila numa pasta temporária e compara com o arquivo publicado.
// Uso: node tests/css.test.js      (precisa de: cd tools/css && npm install)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const raiz = path.resolve(__dirname, '..');
const pasta = path.join(raiz, 'tools', 'css');
const bin = path.join(pasta, 'node_modules', '.bin', 'tailwindcss');
let falhas = 0;
const t = (n, c, x) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + n + (c ? '' : ' -> ' + JSON.stringify(x))); if (!c) falhas++; };

const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
t('index.html carrega o CSS compilado e não usa o Tailwind do CDN', /href="css\/tailwind\.css"/.test(html) && !/cdn\.tailwindcss\.com/.test(html));
const csp = JSON.parse(fs.readFileSync(path.join(raiz, 'vercel.json'), 'utf8')).headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
t('a política de segurança não confia mais no CDN do Tailwind', !/cdn\.tailwindcss\.com/.test(csp), csp);

if (!fs.existsSync(bin)) {
  console.log('PULADO: rode "cd tools/css && npm install" para conferir se o CSS compilado está em dia.');
  process.exit(falhas ? 1 : 0);
}
const tmp = path.join(os.tmpdir(), 'cooperlink-tailwind-' + process.pid + '.css');
execFileSync(bin, ['-c', 'tailwind.config.js', '-i', 'entrada.css', '-o', tmp, '--minify'], { cwd: pasta, stdio: 'pipe' });
const novo = fs.readFileSync(tmp, 'utf8');
const atual = fs.readFileSync(path.join(raiz, 'css', 'tailwind.css'), 'utf8');
fs.unlinkSync(tmp);
t('css/tailwind.css está em dia (rode "cd tools/css && npm run build" se falhar)', novo === atual, { esperado: novo.length, publicado: atual.length });
console.log(falhas ? '\n' + falhas + ' TESTE(S) FALHARAM' : '\nTODOS OS TESTES DE CSS PASSARAM');
process.exit(falhas ? 1 : 0);
