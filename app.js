'use strict';
const $ = id => document.getElementById(id);
const icons = {
  search:'<circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  external:'<path d="M7 17 17 7M7 7h10v10"/>',
  settings:'<path d="M12 8V3m0 18v-5M4 12h5m7 0h5"/><circle cx="12" cy="12" r="4"/><path d="m6 6 3 3m6 6 3 3M6 18l3-3m6-6 3-3"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon:'<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  edit:'<path d="m14 5 5 5M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  up:'<path d="m6 14 6-6 6 6"/>', down:'<path d="m6 10 6 6 6-6"/>',
  trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload:'<path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  check:'<path d="m5 12 4 4L19 6"/>'
};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = svg(el.dataset.icon); });
const clone = value => JSON.parse(JSON.stringify(value));
const snapshot = value => JSON.stringify(value, (key,item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);
const STORAGE = 'personal-nav-config-v1';
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500); }
function validUrl(value) { try { const u = new URL(value); return ['http:','https:'].includes(u.protocol); } catch { return false; } }
const siteIcons = {
  'google.com':'google.png', 'github.com':'github.svg', 'bilibili.com':'bilibili.svg',
  'zhihu.com':'zhihu.svg', 'youtube.com':'youtube.png', 'chatgpt.com':'chatgpt.ico',
  'mail.google.com':'gmail.ico', 'notion.so':'notion.ico', 'notion.com':'notion.ico',
  'douban.com':'douban.svg', 'sspai.com':'sspai.ico', 'v2ex.com':'v2ex.png', 'taobao.com':'taobao.ico',
  'x.com':'x.png', 'twitter.com':'x.png', 'reddit.com':'reddit.svg',
  'discord.com':'discord.png', 'discord.gg':'discord.png', 'telegram.org':'telegram.png', 't.me':'telegram.png',
  'wikipedia.org':'wikipedia.png', 'stackoverflow.com':'stackoverflow.svg',
  'spotify.com':'spotify.png', 'twitch.tv':'twitch.png', 'linkedin.com':'linkedin.ico',
  'dropbox.com':'dropbox.ico', 'netflix.com':'netflix.ico', 'chat.openai.com':'chatgpt.ico'
};
function renderSiteIcon(badge, site) {
  const url = new URL(site.url);
  const host = url.hostname.replace(/^www\./,'');
  let iconHost = host;
  while (!siteIcons[iconHost] && iconHost.includes('.')) iconHost = iconHost.slice(iconHost.indexOf('.') + 1);
  const localIcon = siteIcons[iconHost];
  const favicon = new URL('/favicon.ico',url.origin).href;
  const source = site.icon || (localIcon ? `icons/${localIcon}` : favicon);
  const image = document.createElement('img');
  const glow = document.createElement('span');
  glow.className = 'tile-glow';
  glow.innerHTML = '<span class="tile-glow-light"></span>';
  image.alt = ''; image.className = 'site-logo'; image.width = 48; image.height = 48;
  image.referrerPolicy = 'no-referrer'; image.decoding = 'async';
  const fallback = document.createElement('span');
  fallback.className = 'tile-fallback';
  fallback.textContent = site.badge || [...site.name][0];
  badge.replaceChildren(fallback,glow);
  image.onload = () => { badge.classList.add('has-logo'); badge.replaceChildren(image,glow); };
  let triedFavicon = source === favicon;
  image.onerror = () => { if (!triedFavicon) { triedFavicon = true; image.src = favicon; } };
  image.src = source;
}
const tileGlowPointer = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
let tileGlowFrame = 0;
let tileGlowPoint;
function clearTileGlow() {
  cancelAnimationFrame(tileGlowFrame);
  tileGlowFrame = 0;
  document.querySelectorAll('.tile-glow-light').forEach(light => { light.style.opacity = '0'; });
}
document.addEventListener('pointermove', event => {
  if (!tileGlowPointer.matches || event.pointerType !== 'mouse' || $('settings-dialog').open) return;
  tileGlowPoint = {x:event.clientX,y:event.clientY};
  if (tileGlowFrame) return;
  tileGlowFrame = requestAnimationFrame(() => {
    tileGlowFrame = 0;
    // Read all bounds before painting; the light follows directly without a trailing animation.
    const lights = [...document.querySelectorAll('.tile-glow-light')].map(light => ({light,rect:light.parentElement.getBoundingClientRect()}));
    lights.forEach(({light,rect}) => {
      const x = tileGlowPoint.x - rect.left, y = tileGlowPoint.y - rect.top;
      const distance = Math.hypot(Math.max(-x,0,x-rect.width),Math.max(-y,0,y-rect.height));
      const strength = Math.max(0,1-distance/100);
      if (strength) light.style.transform = `translate(${x-80}px,${y-80}px)`;
      light.style.opacity = String(strength);
    });
  });
}, {passive:true});
document.addEventListener('pointerleave',clearTileGlow);
document.addEventListener('scroll',clearTileGlow,{passive:true,capture:true});
window.addEventListener('blur',clearTileGlow);
tileGlowPointer.addEventListener('change',clearTileGlow);
function validate(c) {
  if (!c || c.version !== 1 || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 30) throw Error('请填写导航页名称（不超过 30 字）。');
  if (c.showEngineLabel === undefined) c.showEngineLabel = true;
  if (c.intro === undefined) c.intro = {eyebrow:'YOUR PERSONAL START PAGE',title:'从这里出发。',subtitle:'搜你所想，去你常去。'};
  if (typeof c.showEngineLabel !== 'boolean') throw Error('搜索引擎标签的显示设置不正确。');
  if (!c.intro || typeof c.intro.eyebrow !== 'string' || c.intro.eyebrow.length > 100 || typeof c.intro.title !== 'string' || c.intro.title.length > 80 || typeof c.intro.subtitle !== 'string' || c.intro.subtitle.length > 150) throw Error('请检查首页三行文字：顶部小字最多 100 字，主标题最多 80 字，副标题最多 150 字。');
  if (!Array.isArray(c.sites) || !Array.isArray(c.engines) || !c.engines.length) throw Error('请至少保留一个搜索引擎。');
  c.sites.forEach((s,i) => { if (!s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 40 || !validUrl(s.url)) throw Error(`第 ${i+1} 个网站：请填写名称与完整的 http/https 地址。`); if (typeof s.badge !== 'string' || s.badge.length > 3 || typeof s.description !== 'string' || s.description.length > 80) throw Error(`第 ${i+1} 个网站：图标文字最多 3 字，描述最多 80 字。`); });
  c.sites.forEach((s,i) => { if (s.icon !== undefined && (typeof s.icon !== 'string' || (s.icon && !validUrl(s.icon)))) throw Error(`第 ${i+1} 个网站：图标地址请使用完整的 http/https 链接，或留空自动获取。`); });
  const ids = new Set();
  c.engines.forEach((e,i) => { if (!e || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 30 || typeof e.id !== 'string' || ids.has(e.id) || !e.id || typeof e.url !== 'string' || !e.url.includes('{q}') || !validUrl(e.url.replaceAll('{q}','test'))) throw Error(`第 ${i+1} 个引擎：请填写名称，搜索地址必须是 http/https，并包含 {q}。`); ids.add(e.id); });
  if (!ids.has(c.defaultEngine)) throw Error('请选择有效的默认搜索引擎。');
  const a = c.appearance;
  if (a && a.compact === undefined) a.compact = false;
  if (!a || typeof a.compact !== 'boolean' || !['solid','image'].includes(a.type) || !/^#[0-9a-f]{6}$/i.test(a.light) || !/^#[0-9a-f]{6}$/i.test(a.dark) || typeof a.image !== 'string' || (a.image && !/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(a.image))) throw Error('外观背景配置格式不正确。');
  if (a.type === 'image' && !a.image) throw Error('请选择背景图片，或改用纯色背景。');
  return c;
}
let config = clone(window.NAV_CONFIG);
let startupMessage = '';
try { const stored = localStorage.getItem(STORAGE); if (stored) config = validate(JSON.parse(stored)); } catch { startupMessage = '本机配置无法读取，已使用服务器配置。'; }
try { validate(config); } catch (error) { document.body.textContent = `配置错误：${error.message} 请恢复有效的 config.js。`; throw error; }
let selectedEngine = config.defaultEngine;
let draft;
let draftBaseline = '';
let serverDraftSnapshot = '';
let deletedSite;
let draftReadToken = 0;
let draftReadPending = false;
let activeTab = 'sites';
const engineSlider = document.createElement('span');
engineSlider.className = 'engine-slider';
engineSlider.hidden = true;
engineSlider.setAttribute('aria-hidden','true');
const reducedEngineMotion = matchMedia('(prefers-reduced-motion: reduce)');
let engineSlideAnimation;
function moveEngineSlider(animate = false) {
  const group = $('engine-options');
  const active = group.querySelector('button[aria-pressed="true"]');
  if (!active) return;
  const rail = group.getBoundingClientRect();
  const target = active.getBoundingClientRect();
  const from = engineSlider.hidden ? null : engineSlider.getBoundingClientRect();
  const x = target.left - rail.left, y = target.top - rail.top;
  const transform = (left,top,sx = 1,sy = 1) => `translate(${left}px,${top}px) scale(${sx},${sy})`;
  engineSlideAnimation?.cancel();
  engineSlider.hidden = false;
  engineSlider.style.width = `${target.width}px`;
  engineSlider.style.height = `${target.height}px`;
  engineSlider.style.transform = transform(x,y);
  if (!animate || !from || reducedEngineMotion.matches) return;
  const startX = from.left - rail.left, startY = from.top - rail.top;
  // Read the live rectangle before cancelling so rapid changes never jump back.
  engineSlideAnimation = engineSlider.animate([
    {transform:transform(startX,startY,from.width / target.width,from.height / target.height)},
    {offset:.62,transform:transform(startX + (x - startX) * .92 - target.width * .02,startY + (y - startY) * .92 + target.height * .02,1.04,.96)},
    {offset:.82,transform:transform(x + target.width * .01,y - target.height * .01,.98,1.02)},
    {transform:transform(x,y)}
  ],{duration:280,easing:'cubic-bezier(0.77,0,0.175,1)'});
}
const engineResize = new ResizeObserver(() => moveEngineSlider());
reducedEngineMotion.addEventListener('change',() => moveEngineSlider());
function renderEngines() {
  engineSlideAnimation?.cancel();
  engineResize.disconnect();
  engineSlider.hidden = true;
  const group = $('engine-options');
  group.replaceChildren(engineSlider);
  config.engines.forEach(engine => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = engine.name;
    button.setAttribute('aria-pressed',String(engine.id === selectedEngine));
    button.onclick = event => {
      if (selectedEngine !== engine.id) {
        selectedEngine = engine.id;
        group.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
        moveEngineSlider(event.detail > 0);
      }
      $('search-input').focus();
    };
    group.append(button);
    engineResize.observe(button);
  });
  engineResize.observe(group);
  moveEngineSlider();
}
function render() {
  document.body.classList.toggle('compact-layout', config.appearance.compact);
  $('brand-name').textContent = config.name;
  document.title = `${config.name} · 个人导航`;
  $('engine-label').hidden = !config.showEngineLabel;
  $('intro-eyebrow').textContent = config.intro.eyebrow;
  $('intro-subtitle').textContent = config.intro.subtitle;
  const title = config.intro.title;
  $('intro-title').replaceChildren();
  if (/[。.!！？?]$/.test(title)) { const mark = document.createElement('span'); mark.textContent = title.slice(-1); $('intro-title').append(document.createTextNode(title.slice(0,-1)),mark); }
  else $('intro-title').textContent = title;
  [['intro-eyebrow','eyebrow'],['intro-title','title'],['intro-subtitle','subtitle']].forEach(([id,key]) => { $(id).hidden = !config.intro[key].trim(); });
  const dark = document.documentElement.dataset.theme === 'dark';
  $('theme-toggle').innerHTML = svg(dark ? 'sun' : 'moon');
  $('theme-toggle').setAttribute('aria-label', dark ? '切换日间模式' : '切换夜间模式');
  const bg = dark ? config.appearance.dark : config.appearance.light;
  document.documentElement.style.setProperty('--page', bg);
  document.body.classList.toggle('custom-background', ![dark ? '#1c1c1e' : '#f5f5f7',dark ? '#121817' : '#f4f6f5'].includes(bg.toLowerCase()));
  const withImage = config.appearance.type === 'image' && !!config.appearance.image;
  document.body.classList.toggle('has-image', withImage);
  document.body.style.setProperty('--background-image', withImage ? `url("${config.appearance.image}")` : 'none');
  renderEngines();
  $('tile-grid').replaceChildren();
  config.sites.forEach(site => {
    const a = document.createElement('a'); a.className = 'tile'; a.href = site.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.setAttribute('aria-label',`${site.name}，在新标签页打开`);
    a.innerHTML = '<span class="tile-badge" aria-hidden="true"></span><span class="tile-copy"><span class="tile-name"></span><span class="tile-description"></span></span><span class="tile-arrow"></span>';
    renderSiteIcon(a.querySelector('.tile-badge'),site); a.querySelector('.tile-name').textContent = site.name; a.querySelector('.tile-description').textContent = site.description || new URL(site.url).hostname; a.querySelector('.tile-arrow').innerHTML = svg('external'); $('tile-grid').append(a);
  });
  $('site-count').textContent = `${config.sites.length} 个`;
  $('empty-state').hidden = config.sites.length !== 0;
  $('tile-grid').hidden = config.sites.length === 0;
}
$('theme-toggle').onclick = () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; try { localStorage.setItem('nav-theme',theme); } catch { toast('主题已切换，但浏览器禁止保存偏好。'); } render(); };
$('search-form').onsubmit = event => { event.preventDefault(); const q = $('search-input').value.trim(); if (!q) return $('search-input').focus(); const engine = config.engines.find(e => e.id === selectedEngine); window.open(engine.url.replaceAll('{q}',encodeURIComponent(q)),'_blank','noopener,noreferrer'); };
function field(label, value, key, max) { const wrap = document.createElement('label'); wrap.className = 'field'; wrap.textContent = label; const input = document.createElement('input'); input.dataset.field = key; input.value = value; if (max) input.maxLength = max; wrap.append(input); return wrap; }
function rowButton(icon, label, click, disabled = false) { const b = document.createElement('button'); b.type = 'button'; b.className = `icon-button ${icon === 'trash' ? 'remove-button' : ''}`; b.innerHTML = svg(icon); b.setAttribute('aria-label',label); b.title = label; b.disabled = disabled; b.onclick = click; return b; }
function collectDraft() {
  document.querySelectorAll('#site-editor .editor-row').forEach((r,i) => { r.querySelectorAll('[data-field]').forEach(input => { draft.sites[i][input.dataset.field] = input.value.trim(); }); });
  document.querySelectorAll('#engine-editor .editor-row').forEach((r,i) => { r.querySelectorAll('[data-field]').forEach(input => { draft.engines[i][input.dataset.field] = input.value.trim(); }); });
  draft.name = $('page-name').value.trim(); draft.defaultEngine = $('default-engine').value;
  draft.showEngineLabel = $('show-engine-label').checked;
  draft.intro = {eyebrow:$('intro-eyebrow-input').value.trim(),title:$('intro-title-input').value.trim(),subtitle:$('intro-subtitle-input').value.trim()};
  Object.assign(draft.appearance,{light:$('light-color').value,dark:$('dark-color').value,type:$('background-type').value,compact:$('compact-layout').checked});
}
function reorder(kind, i, delta) { collectDraft(); const list = draft[kind]; [list[i],list[i+delta]] = [list[i+delta],list[i]]; renderEditors(); }
function remove(kind,i) {
  collectDraft();
  if (kind === 'sites') {
    deletedSite = {site:clone(draft.sites[i]),index:i};
    $('site-undo-message').textContent = `已删除“${draft.sites[i].name || '未命名网站'}”`;
    $('site-undo').hidden = false;
  }
  draft[kind].splice(i,1);
  if (kind === 'engines' && !draft.engines.some(e => e.id === draft.defaultEngine)) draft.defaultEngine = draft.engines[0]?.id || '';
  renderEditors();
}
function renderEditors() {
  [['sites','site-editor'],['engines','engine-editor']].forEach(([kind,id]) => {
    $(id).replaceChildren();
    draft[kind].forEach((item,i) => {
      const row = document.createElement('div'); row.className = 'editor-row'; const fields = document.createElement('div'); fields.className = 'row-fields'; fields.append(field('名称',item.name,'name',kind === 'sites' ? 40 : 30),field(kind === 'sites' ? '网站地址' : '搜索地址（含 {q}）',item.url,'url')); row.append(fields);
      const bottom = document.createElement('div'); bottom.className = 'row-bottom';
      if (kind === 'sites') { const iconField = field('图标地址（留空自动使用品牌图标 / 网站 favicon）',item.icon || '','icon'); iconField.classList.add('icon-url-field'); row.append(iconField); const badge = field('备用文字',item.badge,'badge',3); badge.classList.add('badge-field'); bottom.append(badge,field('简短描述',item.description,'description',80)); }
      const buttons = document.createElement('div'); buttons.className = 'row-buttons'; buttons.append(rowButton('up',`上移第 ${i+1} 项`,() => reorder(kind,i,-1),i === 0),rowButton('down',`下移第 ${i+1} 项`,() => reorder(kind,i,1),i === draft[kind].length-1),rowButton('trash',`删除第 ${i+1} 项`,() => remove(kind,i))); bottom.append(buttons); row.append(bottom); $(id).append(row);
    });
  });
  $('default-engine').replaceChildren(); draft.engines.forEach(e => { const option = document.createElement('option'); option.value = e.id; option.textContent = e.name || '未命名引擎'; $('default-engine').append(option); }); $('default-engine').value = draft.defaultEngine;
  $('page-name').value = draft.name; $('light-color').value = draft.appearance.light; $('dark-color').value = draft.appearance.dark; $('background-type').value = draft.appearance.type;
  $('show-engine-label').checked = draft.showEngineLabel;
  $('compact-layout').checked = draft.appearance.compact;
  $('intro-eyebrow-input').value = draft.intro.eyebrow; $('intro-title-input').value = draft.intro.title; $('intro-subtitle-input').value = draft.intro.subtitle;
  renderImage();
}
function renderImage() { $('image-settings').hidden = $('background-type').value !== 'image'; $('background-preview').hidden = !draft.appearance.image; if (draft.appearance.image) $('background-preview').src = draft.appearance.image; else $('background-preview').removeAttribute('src'); $('remove-background').hidden = !draft.appearance.image; }
function switchTab(tab) { activeTab = tab; document.querySelectorAll('[data-tab]').forEach(b => { const active = b.dataset.tab === tab; b.setAttribute('aria-selected',String(active)); b.tabIndex = active ? 0 : -1; }); ['sites','engines','appearance'].forEach(t => { $(`panel-${t}`).hidden = t !== tab; }); }
document.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => switchTab(b.dataset.tab); b.onkeydown = event => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); const tabs = ['sites','engines','appearance']; let i = tabs.indexOf(activeTab); i = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (i + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3; switchTab(tabs[i]); $(`tab-${tabs[i]}`).focus(); }; });
function clearSiteUndo() { deletedSite = undefined; $('site-undo').hidden = true; }
function setDraftReadPending(pending) {
  draftReadPending = pending;
  ['export-config','import-config','background-upload','use-server'].forEach(id => { $(id).disabled = pending; });
  $('settings-form').querySelector('button[type="submit"]').disabled = pending;
}
function openSettings(tab = 'sites') {
  draft = clone(config);
  serverDraftSnapshot = '';
  clearSiteUndo();
  $('settings-error').hidden = true;
  renderEditors(); collectDraft(); draftBaseline = snapshot(draft);
  switchTab(tab); $('settings-dialog').showModal();
}
function closeSettings() {
  draftReadToken++;
  setDraftReadPending(false);
  $('background-upload').value = $('import-config').value = '';
  $('settings-dialog').close();
}
function requestSettingsClose() {
  collectDraft();
  if (draftReadPending || serverDraftSnapshot || snapshot(draft) !== draftBaseline) $('discard-dialog').showModal();
  else closeSettings();
}
$('open-settings').onclick = () => openSettings(); $('edit-sites').onclick = () => openSettings(); $('add-first').onclick = () => { openSettings(); $('add-site').click(); };
$('close-settings').onclick = $('cancel-settings').onclick = requestSettingsClose;
$('settings-dialog').addEventListener('cancel',event => { event.preventDefault(); requestSettingsClose(); });
$('settings-dialog').addEventListener('click',e => { if (e.target === $('settings-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) requestSettingsClose(); } });
$('continue-editing').onclick = () => $('discard-dialog').close();
$('discard-changes').onclick = () => { $('discard-dialog').close(); closeSettings(); };
$('undo-site').onclick = () => {
  if (!deletedSite) return;
  collectDraft();
  draft.sites.splice(Math.min(deletedSite.index,draft.sites.length),0,deletedSite.site);
  const index = Math.min(deletedSite.index,draft.sites.length-1);
  clearSiteUndo(); renderEditors();
  $('site-editor').children[index].querySelector('input').focus();
};
$('add-site').onclick = () => { collectDraft(); draft.sites.push({name:'',url:'https://',badge:'',description:''}); renderEditors(); $('site-editor').lastElementChild.querySelector('input').focus(); };
$('add-engine').onclick = () => { collectDraft(); draft.engines.push({id:`custom-${Date.now()}`,name:'',url:'https://example.com/search?q={q}'}); if (!draft.defaultEngine) draft.defaultEngine = draft.engines.at(-1).id; renderEditors(); $('engine-editor').lastElementChild.querySelector('input').focus(); };
$('background-type').onchange = renderImage;
$('remove-background').onclick = () => { draft.appearance.image = ''; $('background-type').value = 'solid'; renderImage(); };
function showError(error) { $('settings-error').textContent = error.message; $('settings-error').hidden = false; $('settings-error').scrollIntoView({block:'nearest'}); }
$('settings-form').noValidate = true;
$('settings-form').onsubmit = event => {
  event.preventDefault();
  if (draftReadPending) return;
  try {
    collectDraft(); validate(draft);
    const content = JSON.stringify(draft);
    const useServer = !!serverDraftSnapshot && snapshot(draft) === serverDraftSnapshot;
    if (useServer) localStorage.removeItem(STORAGE);
    else localStorage.setItem(STORAGE,content);
    config = clone(draft); selectedEngine = config.defaultEngine; render(); closeSettings();
    toast(useServer ? '已使用服务器配置，本机修改已清除。' : '已保存，本机立即生效。');
  } catch (error) { showError(error.name === 'QuotaExceededError' ? Error('浏览器存储空间不足，请换一张较小的图片。') : error); }
};
$('background-upload').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  const token = ++draftReadToken;
  setDraftReadPending(true);
  try {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('请选择 JPG、PNG 或 WebP 图片。');
    const image = await createImageBitmap(file);
    if (token !== draftReadToken) { image.close(); return; }
    const ratio = Math.min(1,1920 / Math.max(image.width,image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width*ratio); canvas.height = Math.round(image.height*ratio); canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height); image.close(); draft.appearance.image = canvas.toDataURL('image/webp',.82); $('background-type').value = 'image'; renderImage(); $('settings-error').hidden = true;
  } catch (error) { if (token === draftReadToken) showError(Error(`图片无法读取：${error.message}`)); }
  finally { if (token === draftReadToken) { setDraftReadPending(false); event.target.value = ''; } }
};
$('export-config').onclick = () => { try { collectDraft(); validate(draft); const content = `// 个人导航配置：将此文件上传并覆盖服务器上的 config.js。\nwindow.NAV_CONFIG = ${JSON.stringify(draft,null,2)};\n`; const url = URL.createObjectURL(new Blob([content],{type:'text/javascript;charset=utf-8'})); const a = document.createElement('a'); a.href = url; a.download = 'config.js'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); toast('已导出当前设置（包含背景图片）。'); } catch (error) { showError(error); } };
$('import-config').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  const token = ++draftReadToken;
  setDraftReadPending(true);
  try {
    let content = (await file.text()).trim().replace(/^\uFEFF/,'');
    if (token !== draftReadToken) return;
    content = content.replace(/^(?:\s*\/\/[^\n]*\n)*/,'').trim();
    if (content.startsWith('window.NAV_CONFIG')) content = content.replace(/^window\.NAV_CONFIG\s*=\s*/,'').replace(/;\s*$/,'');
    draft = validate(JSON.parse(content)); serverDraftSnapshot = ''; clearSiteUndo(); renderEditors(); $('settings-error').hidden = true;
    toast('已载入配置，点击保存设置后生效。');
  } catch (error) { if (token === draftReadToken) showError(Error(`导入失败：${error.message}`)); }
  finally { if (token === draftReadToken) { setDraftReadPending(false); event.target.value = ''; } }
};
document.querySelector('.import-label').onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('import-config').click(); } };
$('use-server').onclick = () => {
  try {
    draft = validate(clone(window.NAV_CONFIG));
    clearSiteUndo(); renderEditors(); collectDraft(); serverDraftSnapshot = snapshot(draft); $('settings-error').hidden = true;
    toast('已载入服务器配置，点击保存设置后生效。');
  } catch (error) { showError(error); }
};
render(); if (startupMessage) toast(startupMessage);
