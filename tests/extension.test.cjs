const {test, before, after, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const {mkdtemp, cp, readFile, writeFile, rm} = require('node:fs/promises');
const {spawnSync} = require('node:child_process');
const {tmpdir} = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const vm = require('node:vm');
const {chromium} = require('playwright');

const root = path.resolve(__dirname,'..');
const fallbackUrl = 'https://www.nyqking.top/';
let temporary, bundle, manifest, extensionId, context;

before(async () => {
  temporary = await mkdtemp(path.join(tmpdir(),'qidian-extension-'));
  const built = spawnSync(process.env.PYTHON || 'python3',[path.join(root,'scripts/package-extension.py'),'--output',temporary],{encoding:'utf8'});
  assert.equal(built.status,0,built.stderr);
  bundle = path.join(temporary,'qidian-newtab');
  manifest = JSON.parse(await readFile(path.join(bundle,'manifest.json'),'utf8'));
  extensionId = createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c => 'abcdefghijklmnop'[parseInt(c,16)]);
});
afterEach(async () => { await context?.close(); context = undefined; });
after(async () => { await rm(temporary,{recursive:true,force:true}); });

async function launch(changes = {},offline = false) {
  const folder = await mkdtemp(path.join(temporary,'case-'));
  const extension = path.join(folder,'extension');
  await cp(bundle,extension,{recursive:true});
  for (const [file,content] of Object.entries(changes)) {
    if (content === null) await rm(path.join(extension,file));
    else await writeFile(path.join(extension,file),content);
  }
  context = await chromium.launchPersistentContext(path.join(folder,'profile'),{
    channel:'chromium',headless:true,
    args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]
  });
  context.setDefaultTimeout(10000);
  context.setDefaultNavigationTimeout(15000);
  if (offline) await context.setOffline(true);
  await context.route(`${fallbackUrl}**`,route => route.fulfill({contentType:'text/html',body:'<title>Online fallback</title><h1>Online fallback</h1>'}));
  return context.newPage();
}
async function newTab(page) {
  await page.goto('chrome://newtab/',{waitUntil:'commit'}).catch(error => {
    if (!error.message.includes('ERR_ABORTED')) throw error;
  });
}

test('package is permission-free, uses MV3 CSP and has a complete local entry point',async () => {
  assert.equal(manifest.manifest_version,3);
  assert.equal(manifest.chrome_url_overrides.newtab,'newtab.html');
  assert.equal(manifest.permissions,undefined);
  assert.equal(manifest.host_permissions,undefined);
  assert.doesNotMatch(manifest.content_security_policy.extension_pages,/unsafe-inline|unsafe-eval|https?:/);
  const html = await readFile(path.join(bundle,'newtab.html'),'utf8');
  assert.doesNotMatch(html,/<script\s*>/i);
  assert.ok(html.indexOf('extension-boot.js') < html.indexOf('config.js'));
  assert.match(html,/class="brand" href="newtab.html"/);
  for (const file of ['app.js','theme.js','config.js','styles.css','liquid-glass.css','LICENSE','LICENSES/yzrt-GPL-2.0.txt','THIRD_PARTY_NOTICES.md','icons/sources.json','extension-icons/icon128.png']) assert.ok((await readFile(path.join(bundle,file))).length > 0);
});

test('a real new-tab override loads offline without contacting the fallback site',async () => {
  const page = await launch({},true);
  const requests = []; context.on('request',request => requests.push(request.url()));
  const errors = []; page.on('pageerror',error => errors.push(error.message));
  await newTab(page); await page.locator('#open-settings').waitFor();
  assert.equal(await page.evaluate(() => location.origin),`chrome-extension://${extensionId}`);
  assert.equal(await page.evaluate(() => window.NAV_APP_READY),true);
  assert.equal(await page.locator('.tile').count(),12);
  assert.equal(requests.some(url => url.startsWith(fallbackUrl)),false);
  assert.deepEqual(errors,[]);
  await page.locator('.brand').click();
  await page.locator('#open-settings').waitFor();
  assert.equal(await page.evaluate(() => location.pathname),'/newtab.html');
});

test('settings, theme, image backgrounds and config downloads work under extension CSP',async () => {
  const page = await launch({},true); await newTab(page);
  await page.locator('#theme-toggle').click();
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.locator('#open-settings').click(); await page.locator('#tab-appearance').click();
  await page.locator('#page-name').fill('我的离线起点'); await page.locator('#compact-layout').check();
  await page.locator('#background-type').selectOption('image');
  await page.locator('#background-upload').setInputFiles(path.join(bundle,'extension-icons/icon128.png'));
  await page.waitForFunction(() => !document.getElementById('export-config').disabled);
  await page.getByRole('button',{name:'保存设置'}).click();
  const second = await context.newPage(); await newTab(second);
  await second.locator('#brand-name').filter({hasText:'我的离线起点'}).waitFor();
  assert.equal(await second.evaluate(() => document.documentElement.dataset.theme),theme);
  assert.equal(await second.locator('body').evaluate(el => el.classList.contains('has-image') && el.classList.contains('compact-layout')),true);
  await second.locator('#open-settings').click();
  const downloaded = second.waitForEvent('download'); await second.locator('#export-config').click();
  const config = await downloaded;
  assert.match(await readFile(await config.path(),'utf8'),/我的离线起点/);
});

test('saved-site search opens a separate tab from the extension',async () => {
  const page = await launch(); await newTab(page);
  await context.route('https://github.com/**',route => route.fulfill({contentType:'text/html',body:'<title>GitHub</title>'}));
  await page.locator('#search-input').fill('github');
  const opened = context.waitForEvent('page'); await page.keyboard.press('Enter');
  const result = await opened; await result.waitForLoadState('domcontentloaded');
  assert.equal(result.url(),'https://github.com/');
  assert.equal(await result.evaluate(() => window.opener),null);
  assert.equal(await page.evaluate(() => location.origin),`chrome-extension://${extensionId}`);
});

for (const file of ['app.js','config.js','theme.js','styles.css','liquid-glass.css']) {
  test(`missing ${file} falls back to the specified online page`,async () => {
    const page = await launch({[file]:null});
    let fallbackRequests = 0;
    context.on('request',request => { if (request.url() === fallbackUrl) fallbackRequests++; });
    await newTab(page); await page.waitForURL(fallbackUrl);
    await page.getByRole('heading',{name:'Online fallback'}).waitFor();
    assert.equal(fallbackRequests,1);
  });
}

test('invalid configuration or a startup exception falls back instead of leaving a broken tab',async () => {
  const page = await launch({'config.js':'window.NAV_CONFIG = {version:99};'});
  await newTab(page); await page.waitForURL(fallbackUrl);
});

test('a missing site icon keeps the healthy local page even while offline',async () => {
  const page = await launch({'icons/github.svg':null},true);
  await newTab(page); await page.locator('#open-settings').waitFor();
  assert.equal(await page.evaluate(() => window.NAV_APP_READY),true);
  assert.equal(await page.evaluate(() => location.origin),`chrome-extension://${extensionId}`);
  assert.match(await page.locator('.tile').filter({hasText:'GitHub'}).textContent(),/GH/);
});

test('the startup watchdog waits eight seconds and redirects only once',async () => {
  let callback, timeout, redirects = [];
  const window = {location:{replace:url => redirects.push(url)},addEventListener(){},removeEventListener(){}};
  const document = {addEventListener(){},removeEventListener(){}};
  vm.runInNewContext(await readFile(path.join(root,'extension/boot.js'),'utf8'),{
    window,document,setTimeout(fn,ms){callback = fn; timeout = ms; return 1;},clearTimeout(){},HTMLScriptElement:class {},HTMLLinkElement:class {}
  });
  assert.equal(timeout,8000); assert.deepEqual(redirects,[]);
  callback(); callback(); assert.deepEqual(redirects,[fallbackUrl]);
});

test('packaging is reproducible and ZIP has manifest.json at its root',async () => {
  const first = await readFile(path.join(temporary,`qidian-newtab-${manifest.version}.zip`));
  const built = spawnSync(process.env.PYTHON || 'python3',[path.join(root,'scripts/package-extension.py'),'--output',temporary],{encoding:'utf8'});
  assert.equal(built.status,0,built.stderr);
  assert.deepEqual(await readFile(path.join(temporary,`qidian-newtab-${manifest.version}.zip`)),first);
  const checked = spawnSync(process.env.PYTHON || 'python3',['-c','import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert "manifest.json" in z.namelist(); assert not any(n.startswith("/") or ".." in n.split("/") for n in z.namelist())',path.join(temporary,`qidian-newtab-${manifest.version}.zip`)],{encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr);
});
