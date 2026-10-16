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

async function captureSearchOpens() {
  await page.evaluate(() => { window.searchOpens = []; window.open = (url,target,features) => { window.searchOpens.push({url,target,features}); return null; }; });
}
async function openedSearches() { return page.evaluate(() => window.searchOpens); }

test('search matches saved names and domains, including case and fullwidth input',async () => {
  await visit(); await captureSearchOpens();
  await page.keyboard.press('/');
  assert.equal(await page.locator('#search-input').evaluate(el => el === document.activeElement),true);
  await page.locator('#search-input').fill('ＧＩＴＨＵＢ');
  assert.match(await page.getByRole('option').first().textContent(),/GitHub/);
  assert.equal(await page.locator('#search-input').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#search-input').getAttribute('aria-activedescendant'),'search-option-0');
  await page.keyboard.press('Enter');
  assert.deepEqual(await openedSearches(),[{url:'https://github.com/',target:'_blank',features:'noopener,noreferrer'}]);
  assert.equal(page.url(),`${baseUrl}/`);
  assert.equal(await page.locator('#search-input').getAttribute('aria-expanded'),'false');
  await page.locator('#search-input').fill('mail.google.com');
  assert.match(await page.getByRole('option').first().textContent(),/Gmail/);
});

test('exact names rank first and saved matches are limited to five',async () => {
  const sites = Array.from({length:7},(_,i) => ({...defaults.sites[1],name:`GitHub 项目 ${i}`,url:`https://github.com/project-${i}`}));
  sites.splice(3,0,defaults.sites[1]);
  await visit({...defaults,sites});
  await page.locator('#search-input').fill('github');
  assert.equal(await page.getByRole('option').count(),6);
  assert.equal(await page.getByRole('option').first().getAttribute('aria-label'),'GitHub，github.com，在新标签页打开');
  assert.match(await page.getByRole('option').nth(1).textContent(),/项目 0/);
  assert.match(await page.getByRole('option').last().textContent(),/使用 Bing 搜索互联网/);
  await page.locator('#search-input').fill('github 项目 6');
  assert.equal(await page.getByRole('option').count(),2);
  assert.match(await page.getByRole('option').first().textContent(),/项目 6/);
});

test('opening a saved search result creates a new tab with no opener',async () => {
  await context.route('https://github.com/**',route => route.fulfill({contentType:'text/html',body:'<title>Saved site</title>'}));
  await visit(); await page.locator('#search-input').fill('github');
  assert.equal(await page.getByRole('button',{name:'打开 GitHub',exact:true}).count(),1);
  const newTab = context.waitForEvent('page');
  await page.keyboard.press('Enter');
  const opened = await newTab; await opened.waitForLoadState('domcontentloaded');
  assert.equal(opened.url(),'https://github.com/');
  assert.equal(await opened.evaluate(() => window.opener),null);
  assert.equal(page.url(),`${baseUrl}/`);
});

test('ordinary queries search the selected engine with encoded keywords',async () => {
  await visit(); await captureSearchOpens();
  const query = 'C++ & 中文 / ?';
  await page.locator('#search-input').fill(query);
  assert.equal(await page.getByRole('option').count(),1);
  await page.locator('#nav-heading').click();
  await page.getByRole('button',{name:'Google',exact:true}).click();
  assert.match(await page.getByRole('option').first().textContent(),/使用 Google 搜索互联网/);
  await page.keyboard.press('Enter');
  assert.equal((await openedSearches())[0].url,`https://www.google.com/search?q=${encodeURIComponent(query)}`);
});

test('arrow keys select matches or web search and Shift+Enter always searches the web',async () => {
  await visit(); await captureSearchOpens();
  await page.locator('#search-input').fill('g');
  await page.keyboard.press('ArrowDown');
  assert.match(await page.getByRole('option',{selected:true}).textContent(),/GitHub/);
  await page.keyboard.press('Enter');
  assert.equal((await openedSearches())[0].url,'https://github.com/');
  await page.locator('#search-input').fill('github');
  await page.keyboard.press('ArrowUp');
  assert.match(await page.getByRole('option',{selected:true}).textContent(),/使用 Bing/);
  await page.keyboard.press('Enter');
  await page.locator('#search-input').fill('github');
  await page.keyboard.press('Shift+Enter');
  assert.equal((await openedSearches())[1].url,'https://www.bing.com/search?q=github');
  assert.equal((await openedSearches())[2].url,'https://www.bing.com/search?q=github');
});

test('mouse and touch can open a non-first saved result or choose web search',async () => {
  await page.setViewportSize({width:375,height:812});
  await visit(); await captureSearchOpens();
  await page.locator('#search-input').fill('g');
  await page.getByRole('option').filter({hasText:'GitHub'}).click();
  assert.equal((await openedSearches())[0].url,'https://github.com/');
  await page.locator('#search-input').fill('github');
  await page.getByRole('option').last().click();
  assert.equal((await openedSearches())[1].url,'https://www.bing.com/search?q=github');
  const touchContext = await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
  try {
    const touchPage = await touchContext.newPage(); await touchPage.goto(baseUrl);
    await touchPage.evaluate(() => { window.open = url => { window.touchOpened = url; }; });
    await touchPage.locator('#search-input').fill('g');
    await touchPage.getByRole('option').filter({hasText:'GitHub'}).tap();
    assert.equal(await touchPage.evaluate(() => window.touchOpened),'https://github.com/');
  } finally { await touchContext.close(); }
});

test('Escape clears search while slash respects text fields and settings',async () => {
  await visit(); await captureSearchOpens();
  await page.locator('#search-input').fill('github'); await page.keyboard.press('Escape');
  assert.equal(await page.locator('#search-input').inputValue(),'');
  assert.equal(await page.locator('#search-input').evaluate(el => el === document.activeElement),true);
  assert.equal(await page.locator('#search-input').getAttribute('aria-activedescendant'),null);
  await page.keyboard.press('/'); assert.equal(await page.locator('#search-input').inputValue(),'/');
  await page.keyboard.press('Escape'); await page.keyboard.press('Enter');
  assert.deepEqual(await openedSearches(),[]);
  await appearance(); await page.locator('#page-name').focus(); await page.keyboard.press('/');
  assert.equal(await page.locator('#page-name').inputValue(),`${defaults.name}/`);
  await page.locator('#page-name').fill(defaults.name); await page.locator('#cancel-settings').focus(); await page.keyboard.press('/');
  assert.equal(await page.locator('#cancel-settings').evaluate(el => el === document.activeElement),true);
  await page.locator('#cancel-settings').click();
  await page.evaluate(() => { const editor = document.createElement('div'); editor.id = 'test-editor'; editor.contentEditable = 'true'; document.body.append(editor); editor.focus(); });
  await page.keyboard.press('/'); assert.equal(await page.locator('#test-editor').textContent(),'/');
});

test('IME confirmation does not launch a site or handle navigation shortcuts',async () => {
  await visit(); await captureSearchOpens();
  await page.locator('#search-input').fill('知乎');
  await page.locator('#search-input').dispatchEvent('compositionstart');
  assert.equal(await page.locator('#search-suggestions').isVisible(),false);
  await page.keyboard.press('Enter');
  await page.locator('#search-form').dispatchEvent('submit');
  assert.deepEqual(await openedSearches(),[]);
  await page.locator('#search-input').dispatchEvent('keydown',{key:'Escape',isComposing:true});
  assert.equal(await page.locator('#search-input').inputValue(),'知乎');
  await page.locator('#search-input').dispatchEvent('compositionend');
  assert.match(await page.getByRole('option').first().textContent(),/知乎/);
  await page.keyboard.press('Enter'); assert.equal((await openedSearches())[0].url,'https://www.zhihu.com/');
});

test('suggestions close on outside interaction or Tab and preserve query text',async () => {
  await visit(); await page.locator('#search-input').fill('github');
  await page.locator('#nav-heading').click();
  assert.equal(await page.locator('#search-suggestions').isVisible(),false);
  assert.equal(await page.locator('#search-input').inputValue(),'github');
  await page.locator('#search-input').focus(); assert.equal(await page.locator('#search-suggestions').isVisible(),true);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#search-suggestions').isVisible(),false);
  assert.equal(await page.locator('#search-input').getAttribute('aria-activedescendant'),null);
});

test('search uses edited sites immediately after settings are saved',async () => {
  await visit(); await page.locator('#open-settings').click();
  await page.locator('#site-editor [data-field="name"]').first().fill('新收藏入口'); await save();
  await page.locator('#search-input').fill('新收藏');
  assert.match(await page.getByRole('option').first().textContent(),/新收藏入口/);
  await page.locator('#open-settings').click();
  await page.locator('#site-editor .editor-row').first().getByRole('button',{name:'删除第 1 项',exact:true}).click(); await save();
  await page.locator('#search-input').focus();
  assert.equal(await page.getByRole('option').count(),1);
  assert.match(await page.getByRole('option').first().textContent(),/使用 Bing/);
});

test('long or HTML-like queries are rendered as text and suggestions fit mobile and desktop',async () => {
  await visit();
  const query = '<img src=x onerror="window.injected=1">'.repeat(8);
  await page.locator('#search-input').fill(query);
  assert.equal(await page.locator('#search-results img').count(),0);
  assert.equal(await page.evaluate(() => window.injected),undefined);
  assert.match(await page.getByRole('option').first().textContent(),/<img src=x/);
  for (const width of [320,375,768,1280]) {
    await page.setViewportSize({width,height:812});
    for (const theme of ['light','dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme,theme);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
      assert.equal(await page.locator('#search-suggestions').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }),true);
    }
  }
});
