const {test, before, after, beforeEach, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const {readFile} = require('node:fs/promises');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {chromium} = require('playwright');

const root = path.resolve(__dirname,'..');
const storageKey = 'personal-nav-config-v1';
const sandbox = {window:{}};
vm.runInNewContext(readFileSync(path.join(root,'config.js'),'utf8'),sandbox);
const defaults = JSON.parse(JSON.stringify(sandbox.window.NAV_CONFIG));
let server, browser, context, page, baseUrl, pageErrors;

before(async () => {
  const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
  server = createServer(async (req,res) => {
    const file = path.resolve(root,`.${new URL(req.url,'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url,'http://localhost').pathname}`);
    if (!file.startsWith(`${root}${path.sep}`)) { res.writeHead(403).end(); return; }
    try { const body = await readFile(file); res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream'}).end(body); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})});
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });
beforeEach(async () => {
  context = await browser.newContext({viewport:{width:1280,height:900}});
  page = await context.newPage();
  pageErrors = [];
  page.on('pageerror',error => pageErrors.push(error.message));
});
afterEach(async () => { await context.close(); assert.deepEqual(pageErrors,[]); });

async function visit(localConfig) {
  await page.goto(baseUrl);
  if (localConfig) {
    await page.evaluate(({key,value}) => localStorage.setItem(key,JSON.stringify(value)),{key:storageKey,value:localConfig});
    await page.reload();
  }
}
async function appearance() { await page.locator('#open-settings').click(); await page.locator('#tab-appearance').click(); }
async function localValue() { return page.evaluate(key => localStorage.getItem(key),storageKey); }
async function save() { await page.locator('button[type="submit"]').filter({hasText:'保存设置'}).click(); }

test('opening and closing unchanged settings does not prompt or write storage',async () => {
  await visit();
  for (const close of [() => page.locator('#cancel-settings').click(),() => page.locator('#close-settings').click(),() => page.keyboard.press('Escape'),() => page.mouse.click(2,2)]) {
    await page.locator('#open-settings').click();
    await close();
    assert.equal(await page.locator('#settings-dialog').isVisible(),false);
    assert.equal(await page.locator('#discard-dialog').isVisible(),false);
  }
  assert.equal(await localValue(),null);
});

for (const close of ['cancel','close','escape','backdrop']) {
  test(`unsaved edits survive ${close} and can be continued or discarded`,async () => {
    await visit(); await appearance();
    await page.locator('#page-name').fill('未保存导航');
    if (close === 'cancel') await page.locator('#cancel-settings').click();
    if (close === 'close') await page.locator('#close-settings').click();
    if (close === 'escape') await page.keyboard.press('Escape');
    if (close === 'backdrop') await page.mouse.click(2,2);
    assert.equal(await page.locator('#discard-dialog').isVisible(),true);
    assert.equal(await page.locator('#continue-editing').evaluate(el => el === document.activeElement),true);
    await page.locator('#continue-editing').click();
    assert.equal(await page.locator('#page-name').inputValue(),'未保存导航');
    await page.locator('#cancel-settings').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#discard-dialog').isVisible(),false);
    assert.equal(await page.locator('#settings-dialog').isVisible(),true);
    await page.locator('#cancel-settings').click(); await page.locator('#discard-changes').click();
    assert.equal(await page.locator('#settings-dialog').isVisible(),false);
    assert.equal(await localValue(),null);
    await appearance();
    assert.equal(await page.locator('#page-name').inputValue(),defaults.name);
  });
}

test('restoring the server config remains a draft until saved',async () => {
  const local = {...defaults,name:'本机导航'};
  await visit(local); const stored = await localValue();
  await appearance(); await page.locator('#use-server').click();
  assert.equal(await page.locator('#page-name').inputValue(),defaults.name);
  assert.equal(await page.locator('#brand-name').textContent(),local.name);
  assert.equal(await localValue(),stored);
  await page.locator('#cancel-settings').click(); await page.locator('#discard-changes').click();
  await page.reload();
  assert.equal(await page.locator('#brand-name').textContent(),local.name);
  assert.equal(await localValue(),stored);
  await appearance(); await page.locator('#use-server').click(); await save();
  assert.equal(await page.locator('#brand-name').textContent(),defaults.name);
  assert.equal(await localValue(),null);
  await page.route('**/config.js',route => route.fulfill({contentType:'text/javascript',body:`window.NAV_CONFIG=${JSON.stringify({...defaults,name:'更新后的服务器'})};`}));
  await page.reload();
  assert.equal(await page.locator('#brand-name').textContent(),'更新后的服务器');
});

test('editing a loaded server draft creates a local override',async () => {
  await visit({...defaults,name:'原本机配置'}); await appearance();
  await page.locator('#use-server').click(); await page.locator('#page-name').fill('基于服务器修改'); await save();
  assert.equal(JSON.parse(await localValue()).name,'基于服务器修改');
  await page.reload(); assert.equal(await page.locator('#brand-name').textContent(),'基于服务器修改');
});

test('undoing a deletion restores its position and keeps subsequent edits',async () => {
  await visit(); await page.locator('#open-settings').click();
  await page.locator('#site-editor .editor-row').nth(1).getByRole('button',{name:'删除第 2 项',exact:true}).click();
  await page.locator('#site-editor [data-field="description"]').first().fill('新的描述');
  await page.locator('#undo-site').click();
  assert.equal(await page.locator('#site-editor .editor-row').count(),defaults.sites.length);
  assert.equal(await page.locator('#site-editor [data-field="name"]').nth(1).inputValue(),defaults.sites[1].name);
  assert.equal(await page.locator('#site-editor [data-field="description"]').first().inputValue(),'新的描述');
  await save(); assert.equal(JSON.parse(await localValue()).sites[0].description,'新的描述');
});

test('undoing the only edit or reverting a field closes without a prompt',async () => {
  await visit(); await page.locator('#open-settings').click();
  await page.locator('#site-editor .editor-row').first().getByRole('button',{name:'删除第 1 项',exact:true}).click();
  await page.locator('#undo-site').click(); await page.locator('#cancel-settings').click();
  assert.equal(await page.locator('#discard-dialog').isVisible(),false);
  assert.equal(await page.locator('#settings-dialog').isVisible(),false);
  await appearance(); await page.locator('#page-name').fill('暂时改名'); await page.locator('#page-name').fill(defaults.name);
  await page.locator('#cancel-settings').click();
  assert.equal(await page.locator('#discard-dialog').isVisible(),false);
});

test('compact mode is opt-in, persists and round-trips through config export/import',async () => {
  await visit(); assert.equal(await page.locator('body').evaluate(el => el.classList.contains('compact-layout')),false);
  await appearance(); await page.locator('#compact-layout').check();
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('compact-layout')),false);
  const downloaded = page.waitForEvent('download'); await page.locator('#export-config').click();
  const configFile = await downloaded;
  const exported = await readFile(await configFile.path());
  assert.match(exported.toString(),/"compact": true/);
  await save(); await page.reload();
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('compact-layout')),true);
  assert.equal(await page.locator('.tile-description').first().isVisible(),false);
  await appearance(); await page.locator('#compact-layout').uncheck(); await save();
  await appearance(); await page.locator('#import-config').setInputFiles({name:'config.js',mimeType:'text/javascript',buffer:exported});
  await page.waitForFunction(() => document.getElementById('compact-layout').checked);
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('compact-layout')),false);
  await save(); assert.equal(JSON.parse(await localValue()).appearance.compact,true);
});

test('legacy server and local configs default to the existing layout',async () => {
  const legacy = JSON.parse(JSON.stringify(defaults)); delete legacy.appearance.compact;
  await page.route('**/config.js',route => route.fulfill({contentType:'text/javascript',body:`window.NAV_CONFIG=${JSON.stringify(legacy)};`}));
  await visit(); await appearance();
  assert.equal(await page.locator('#compact-layout').isChecked(),false);
  await page.locator('#cancel-settings').click();
  assert.equal(await page.locator('#discard-dialog').isVisible(),false);
  await visit({...legacy,name:'旧本机配置'}); await appearance();
  assert.equal(await page.locator('#compact-layout').isChecked(),false);
  await page.locator('#cancel-settings').click();
  assert.equal(await page.locator('#discard-dialog').isVisible(),false);
});

test('discarding a pending image read cannot modify a reopened draft',async () => {
  await visit(); await appearance();
  await page.evaluate(() => { const decode = window.createImageBitmap.bind(window); window.createImageBitmap = file => new Promise(resolve => { window.finishImageRead = () => decode(file).then(image => resolve(image)); }); });
  await page.locator('#background-type').selectOption('image');
  await page.locator('#background-upload').setInputFiles({name:'background.png',mimeType:'image/png',buffer:await readFile(path.join(root,'icons/google.png'))});
  await page.locator('#cancel-settings').click(); await page.locator('#discard-changes').click();
  await appearance(); await page.evaluate(() => window.finishImageRead());
  await page.waitForFunction(() => !document.getElementById('background-upload').disabled);
  assert.equal(await page.locator('#background-type').inputValue(),'solid');
  assert.equal(await page.locator('#settings-error').isVisible(),false);
  await page.locator('#cancel-settings').click();
  assert.equal(await page.locator('#discard-dialog').isVisible(),false);
});

test('compact layout fits mobile widths and shows more shortcuts in the first screen',async () => {
  await page.setViewportSize({width:375,height:812}); await visit();
  const visibleTiles = () => page.locator('.tile').evaluateAll(els => els.filter(el => el.getBoundingClientRect().bottom <= innerHeight).length);
  const comfortableCount = await visibleTiles();
  await appearance(); await page.locator('#compact-layout').check(); await save();
  assert.ok(await visibleTiles() > comfortableCount);
  for (const width of [320,375,600,768,1280]) {
    await page.setViewportSize({width,height:812});
    for (const theme of ['light','dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme,theme);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,`${width}px ${theme} overflows`);
      assert.equal(await page.locator('.tile-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length),width <= 1000 ? 3 : 6);
    }
  }
});
