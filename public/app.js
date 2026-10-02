import { APPS, APP_MAP, CATEGORIES } from './catalogue.js';
import { escapeHtml as e } from './domain.js';

const $ = (selector, parent = document) => parent.querySelector(selector);
const main = $('#main');
const initial = JSON.parse($('#initial-data')?.textContent || 'null');
const path = location.pathname;
const params = new URLSearchParams(location.search);
const number = n => new Intl.NumberFormat('en-GB').format(n);
const logo = (app, className = '') => `<img class="app-icon ${className}" src="/icons/${e(app.id)}.png" alt="" width="48" height="48" loading="lazy">`;
const appNames = apps => apps.map(a => a.name).join(', ');
let toastTimer;
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500); }
function remember(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ } }
function recall(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
async function api(url, options = {}) {
  const response = await fetch(url, options);
  let data;
  try { data = await response.json(); } catch { throw new Error('The service is temporarily unavailable. Please try again.'); }
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
async function pick(ids, from) {
  return api('/api/picks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apps: ids, from }) });
}
async function copy(text, success) {
  try { await navigator.clipboard.writeText(text); toast(success); }
  catch { window.prompt('Copy this text:', text); }
}
function errorState(message) {
  main.innerHTML = `<section class="empty-page"><span class="eyebrow">A TAB TOO FAR</span><h1>Nothing here. Yet.</h1><p>${e(message)}</p><a class="button primary" href="/">Pick your four <span>↗</span></a></section>`;
}
function stackCard(stack, index) {
  return `<a class="stack-row" href="/s/${e(stack.id)}"><span class="row-number">${index !== undefined ? String(index + 1).padStart(2, '0') : '↗'}</span><span class="mini-icons">${stack.apps.map(app => logo(app)).join('')}</span><span class="stack-row-label">${e(stack.apps.map(a => a.name).join(' + '))}</span><span class="pick-total">${number(stack.picks)} <small>${stack.picks === 1 ? 'pick' : 'picks'}</small></span><span class="row-arrow" aria-hidden="true">↗</span></a>`;
}
function renderPicker() {
  const saved = recall('saas-off-selection', []);
  let selected = Array.isArray(saved) ? [...new Set(saved)].filter(id => APP_MAP.has(id)).slice(0, 4) : [];
  const prefill = params.get('app');
  if (APP_MAP.has(prefill)) selected = [prefill, ...selected.filter(id => id !== prefill)].slice(0, 4);
  let category = 'All apps'; let term = ''; let busy = false;
  main.innerHTML = `<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="tiny-dot"></span> FOUR SLOTS. BIG DECISIONS.</div><h1>Only four tabs.<br><span class="highlight">Choose wisely.</span></h1><p class="hero-description">If you could only keep four apps open, which would you choose? Pick your favourites, share your line-up and see which SaaS product leads the pack.</p><div class="hero-promises"><span>↗ Made to share</span><span>◎ Back your favourites</span><span>↳ No sign-up</span></div></div><div class="picker-panel"><div class="panel-top"><h2>Your final four</h2><span class="small-tag">NO WRONG ANSWERS</span></div><p class="panel-hint">Four slots. Who makes the cut?</p><div id="slots" class="slots" aria-label="Your four selected apps"></div><div class="selection-summary"><span id="selection-count" role="status" aria-live="polite"></span><button id="clear" class="text-button" type="button">Clear all</button></div><button id="create" class="button primary create-button" type="button" disabled>Lock in my four <span aria-hidden="true">↗</span></button><p class="under-button">No sign-up. No wrong answers. Some questionable choices.</p><p id="form-error" class="inline-error" role="alert"></p></div></section>
    <section class="catalogue" aria-labelledby="catalogue-title"><div class="section-heading"><div><span class="eyebrow">THE REGULARS, AND THEN SOME</span><h2 id="catalogue-title">Make room for your favourites.</h2></div><label class="search-box"><span aria-hidden="true">⌕</span><span class="sr-only">Search apps</span><input id="search" type="search" placeholder="Search apps, brands, tools…" autocomplete="off" maxlength="80"><kbd>/</kbd></label></div><div id="categories" class="category-tabs" role="group" aria-label="Filter apps">${CATEGORIES.map((cat, i) => `<button type="button" class="category ${i === 0 ? 'active' : ''}" data-category="${e(cat)}" aria-pressed="${i === 0}">${e(cat)}</button>`).join('')}</div><div id="app-grid" class="app-grid"></div><div class="catalogue-foot"><span id="results-count"></span><a href="https://github.com/alickf/saas-off/issues/new?template=app-request.yml" target="_blank" rel="noopener noreferrer">Missing your go-to? Suggest an app ↗</a></div></section>
    <section class="bottom-prompt"><span class="prompt-icon" aria-hidden="true">✳</span><div><h2>Who’s leading the pack?</h2><p>Every pick backs your four apps. See the fan favourites and the combinations climbing the leaderboard.</p></div><a class="button secondary" href="/leaderboard">See the leaderboard ↗</a></section>`;
  function updateSlots() {
    $('#slots').innerHTML = Array.from({ length: 4 }, (_, i) => {
      const app = APP_MAP.get(selected[i]);
      return app ? `<button type="button" class="slot filled" data-remove="${e(app.id)}" aria-label="Remove ${e(app.name)}">${logo(app)}<span class="slot-name">${e(app.name)}</span><span class="remove-indicator" aria-hidden="true">×</span></button>` : `<button type="button" class="slot empty" data-empty="true" aria-label="Choose an app for slot ${i + 1}"><span class="slot-plus" aria-hidden="true">+</span><span>Add an app</span></button>`;
    }).join('');
    $('#selection-count').innerHTML = `<strong>${selected.length} / 4</strong> apps picked`;
    $('#create').disabled = selected.length !== 4 || busy;
    $('#clear').disabled = selected.length === 0 || busy;
    remember('saas-off-selection', selected);
  }
  function updateGrid() {
    const needle = term.trim().toLowerCase();
    const results = APPS.filter(app => (category === 'All apps' || app.category === category) && `${app.name} ${app.domain} ${app.aliases}`.toLowerCase().includes(needle));
    $('#app-grid').innerHTML = results.length ? results.map(app => {
      const chosen = selected.includes(app.id);
      return `<button type="button" class="app-card ${chosen ? 'selected' : ''}" data-app="${e(app.id)}" aria-pressed="${chosen}" aria-label="${chosen ? 'Remove' : 'Add'} ${e(app.name)}" ${!chosen && selected.length === 4 ? 'disabled' : ''}>${logo(app)}<span class="app-name">${e(app.name)}</span><span class="app-category">${e(app.category)}</span><span class="app-add" aria-hidden="true">${chosen ? '✓' : '+'}</span></button>`;
    }).join('') : '<div class="empty-grid"><h3>No app by that name. Yet.</h3><p>Try another search or suggest an app below.</p></div>';
    $('#results-count').textContent = `${results.length} ${results.length === 1 ? 'app' : 'apps'} · Pick any four`;
  }
  function changeSelection(id) { if (busy) return; selected = selected.includes(id) ? selected.filter(x => x !== id) : selected.length < 4 ? [...selected, id] : selected; $('#form-error').textContent = ''; updateSlots(); updateGrid(); }
  $('#slots').addEventListener('click', event => { const remove = event.target.closest('[data-remove]'); if (remove) changeSelection(remove.dataset.remove); else if (event.target.closest('[data-empty]')) { $('#search').focus(); $('#search').scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
  $('#app-grid').addEventListener('click', event => { const button = event.target.closest('[data-app]'); if (button) changeSelection(button.dataset.app); });
  $('#clear').addEventListener('click', () => { selected = []; updateSlots(); updateGrid(); });
  $('#search').addEventListener('input', event => { term = event.target.value; updateGrid(); });
  $('#categories').addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (!button) return; category = button.dataset.category; for (const el of $('#categories').children) { el.classList.toggle('active', el === button); el.setAttribute('aria-pressed', String(el === button)); } updateGrid(); });
  document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !event.metaKey && !event.ctrlKey) { event.preventDefault(); $('#search').focus(); } });
  $('#create').addEventListener('click', async () => {
    if (busy || selected.length !== 4) return;
    busy = true; updateSlots(); $('#create').textContent = 'Locking in your four…'; $('#form-error').textContent = '';
    try { const stack = await pick(selected, params.get('from')); location.assign(`/s/${stack.id}`); }
    catch (error) { $('#form-error').textContent = error.message; busy = false; updateSlots(); $('#create').innerHTML = 'Lock in my four <span aria-hidden="true">↗</span>'; }
  });
  updateSlots(); updateGrid();
}
async function renderStack(stack) {
  if (!stack) { errorState('That stack does not exist.'); return; }
  const shareUrl = new URL(`/s/${stack.id}`, location.origin).href;
  const caption = `Only four tabs. These are the apps I’d keep.\n\n${stack.apps.map(a => a.name).join(' · ')}\n\nNo fifth tab. No easy choices. Which four would you pick?\n${shareUrl}`;
  main.innerHTML = `<section class="result-header"><a class="back-link" href="/?from=${e(stack.id)}">← Pick a different four</a><span class="eyebrow">FOUR APPS. ONE VERY PERSONAL CHOICE.</span><h1>Four slots. <span class="highlight">Filled.</span></h1><p>A solid line-up. A controversial omission? Share your four and let the friendly debate begin.</p></section><section class="result-layout"><div class="share-art"><img src="/og/${e(stack.id)}.png?v=2" alt="${e(appNames(stack.apps))} — my four everyday apps" width="1200" height="630" fetchpriority="high"></div><aside class="share-panel"><span class="eyebrow">BACK YOUR LINE-UP</span><h2 id="pick-headline">${stack.picks === 1 ? 'First to pick these four.<br>Start a trend.' : `${number(stack.picks)} picks.<br>The same four.`}</h2><div class="result-stats"><div><strong id="picks-value">${number(stack.picks)}</strong><span>active ${stack.picks === 1 ? 'pick' : 'picks'}</span></div><div><strong>${stack.rank ? '#' + number(stack.rank) : '—'}</strong><span>leaderboard rank</span></div></div><a class="button primary" id="share-linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener noreferrer">Share on LinkedIn ↗</a><button class="button secondary" id="same-four" type="button">These are my four too <span>+</span></button><div class="share-tools"><button class="text-button" id="copy-link" type="button">Copy link</button><button class="text-button" id="copy-caption" type="button">Copy caption</button><a href="/og/${e(stack.id)}.png?v=2" download="saas-off-${e(stack.id)}.png">Save image ↓</a></div><p class="fine-print">LinkedIn opens a link post. The preview uses this image; you can also save it for a native image post.</p><p id="result-error" role="alert" class="inline-error"></p></aside></section><section class="neighbours"><div class="section-heading"><div><span class="eyebrow">CLOSE, BUT NOT QUITE</span><h2>Three out of four ain’t bad.</h2></div><a class="text-link" href="/leaderboard">All stacks ↗</a></div>${stack.neighbours?.length ? `<p class="section-intro">Your nearest neighbours share three of your four apps.</p><div class="stack-list">${stack.neighbours.map((s, i) => stackCard(s, i)).join('')}</div>` : '<div class="empty-state"><span class="empty-symbol">↗</span><div><h3>Your nearest neighbours haven’t arrived yet.</h3><p>Share your stack. The first three-out-of-four match could be a click away.</p></div></div>'}</section><div class="disclosure">Picks are anonymous browser submissions, not verified people. One active pick per browser; changing your stack moves your pick.</div>`;
  $('#copy-link').addEventListener('click', () => copy(shareUrl, 'Link copied. Show the world your four.'));
  $('#copy-caption').addEventListener('click', () => copy(caption, 'Caption copied. Make it your own.'));
  $('#same-four').addEventListener('click', async () => {
    const button = $('#same-four'); button.disabled = true; $('#result-error').textContent = '';
    try {
      const result = await pick(stack.apps.map(a => a.id));
      remember('saas-off-selection', stack.apps.map(a => a.id));
      $('#picks-value').textContent = number(result.picks);
      button.innerHTML = 'You’re in. These are your four ✓';
      toast(result.unchanged ? 'Already counted. Refreshing never adds another pick.' : result.moved ? 'Your pick has moved to this stack.' : 'Your pick is in. Welcome to the same-four club.');
    } catch (error) { $('#result-error').textContent = error.message; button.disabled = false; }
  });
}
async function renderLeaderboard(app) {
  const brandMode = Boolean(app); let type = brandMode ? 'stacks' : 'apps';
  main.innerHTML = `<section class="page-heading"><span class="eyebrow">${brandMode ? 'A SPOT IN YOUR EVERYDAY FOUR' : 'THE PEOPLE HAVE PICKED'}</span><h1>${brandMode ? `${e(app.name)}.<br><span class="highlight">Did we make your four?</span>` : 'Who’s <span class="highlight">leading the pack?</span>'}</h1><p>${brandMode ? `Explore the combinations that include ${e(app.name)}. What are your other three?` : 'Big names. Cult favourites. Unexpected combinations. See which apps make the cut most often.'}</p>${brandMode ? `<a class="button primary inline-button" href="/?app=${e(app.id)}">Build my four with ${e(app.name)} ↗</a>` : ''}</section><section class="leaderboard-section"><div class="leaderboard-top"><div class="segmented" role="group" aria-label="Leaderboard type">${brandMode ? '' : '<button type="button" id="apps-tab" class="active" aria-pressed="true">Individual apps</button>'}<button type="button" id="stacks-tab" class="${brandMode ? 'active' : ''}" aria-pressed="${brandMode}">App combinations</button></div><span id="board-stats" class="muted">Loading picks…</span></div><div id="board-content" aria-live="polite"><div class="loading-state">Opening the tabs…</div></div><p class="disclosure">Rankings may take up to 30 seconds to catch up. Active picks from the last 180 days. Anonymous, self-selected submissions—not verified users or market share. Brand campaigns can affect the mix.</p></section>${brandMode ? '<p class="brand-disclaimer">Independent community page. No endorsement or sponsorship by this brand is implied.</p>' : '<section class="bottom-prompt"><span class="prompt-icon" aria-hidden="true">＋</span><div><h2>The leaderboard needs your questionable taste.</h2><p>Back your favourites. Pick four apps and put your line-up on the board.</p></div><a class="button primary" href="/">Pick my four ↗</a></section>'}`;
  let data;
  function display() {
    if (!data.stats.picks || (brandMode && !data.stacks.length)) { $('#board-content').innerHTML = '<div class="empty-state large"><span class="empty-symbol">✳</span><div><h2>A clean slate. A good place to start.</h2><p>No picks here yet. Be the first to share your four.</p><a href="/" class="text-link">Make the first pick ↗</a></div></div>'; return; }
    $('#board-content').innerHTML = type === 'stacks' ? `<div class="stack-list">${data.stacks.map(stackCard).join('')}</div>` : `<div class="brand-list">${data.apps.map((a, i) => `<a class="brand-row" href="/apps/${e(a.id)}"><span class="row-number">${String(i + 1).padStart(2, '0')}</span>${logo(a)}<span class="brand-row-name">${e(a.name)}<small>${e(a.category)}</small></span><span class="pick-total">${number(a.picks)} <small>picks</small></span><span class="row-arrow">↗</span></a>`).join('')}</div>`;
  }
  try { data = await api('/api/leaderboard' + (app ? `?app=${encodeURIComponent(app.id)}` : '')); $('#board-stats').textContent = `${number(data.stats.picks)} picks · ${number(data.stats.combinations)} combinations`; display(); }
  catch (error) { $('#board-content').innerHTML = `<div class="empty-state"><p>${e(error.message)}</p><button class="button secondary" id="retry">Try again</button></div>`; $('#retry').addEventListener('click', () => renderLeaderboard(app)); $('#board-stats').textContent = ''; }
  for (const button of document.querySelectorAll('.segmented button')) button.addEventListener('click', () => { type = button.id === 'apps-tab' ? 'apps' : 'stacks'; for (const b of document.querySelectorAll('.segmented button')) { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); } if (data) display(); });
}
function infoPage(privacy) {
  main.innerHTML = `<article class="prose"><span class="eyebrow">${privacy ? 'LESS DATA. MORE TABS.' : 'A SMALL, OPEN EXPERIMENT'}</span><h1>${privacy ? 'Your four.<br>Not your life story.' : 'Only four tabs.<br>Who makes the cut?'}</h1>${privacy ? `<p>There is no account to create. SaaS-Off does not ask for your name, email address, employer or LinkedIn credentials, and it never reads your browser tabs or history.</p><h2>What the app stores</h2><p>Your chosen combination, when you last picked it, an anonymous browser identifier and (when supplied) the stack that referred you. We store a keyed hash of the identifier, not your cookie value. Picks expire after 180 days without a submission; daily housekeeping removes expired picks.</p><h2>One functional cookie</h2><p>When you submit, a first-party, HTTP-only cookie called <code>so_visitor</code> remembers your anonymous pick for up to 180 days. Choosing a different combination moves that browser’s pick. Clearing cookies, using another browser or automated submissions can create additional picks, so counts are approximate—not verified people.</p><p>The picker also remembers your unfinished selection in your browser’s local storage. That selection stays on your device until you submit it. No third-party analytics or advertising scripts are included.</p><h2>Abuse protection</h2><p>The app processes the connection’s IP address to derive a short-lived, keyed rate-limit bucket. It does not store the raw IP address in its database. Buckets stop applying after ten minutes and are deleted by daily housekeeping. The hosting provider may process connection data independently to operate and protect its service.</p><h2>Sharing is your choice</h2><p>Public stack pages show only app names and aggregate picks. A LinkedIn button opens LinkedIn in a new tab; no LinkedIn SDK is loaded here. We do not read posts or publish on your behalf.</p><h2>Questions or concerns</h2><p>Use the repository’s security reporting guidance for private concerns. Do not publish personal data in a public issue. This page describes the application’s implementation; self-hosting operators are responsible for their own hosting and privacy arrangements.</p>` : `<p>Imagine your browser only had room for four apps. Brutal, we know. SaaS-Off turns your final four into a shareable card and gives each app a pick on the leaderboard. No sign-up, no browser snooping, just a bit of friendly SaaS rivalry.</p><h2>One combination, one page</h2><p>Choose four different apps. Order does not matter: Jira + Figma + GitHub + Netlify is the same combination however you enter it. Matching submissions use the same URL and share a pick count.</p><h2>A friendly rivalry, not a verdict</h2><p>A pick means “these are my four”, not “this software is the best”. One anonymous browser has one active pick, which moves when you choose another stack. Public views, link crawlers and image downloads never vote.</p><h2>For the brands in our tabs</h2><p>Each app has a community page with its popular combinations and a link that prefills one slot. Ask “Did we make your four?” and let your community choose the other three. These pages are independent and do not imply brand endorsement.</p><h2>Open by design</h2><p>The application code is MIT-licensed. Brand names and logos remain subject to their owners’ rights and are not covered by that licence. The catalogue is curated; suggest missing apps or contribute an improvement on GitHub.</p><a class="button primary inline-button" href="https://github.com/alickf/saas-off" target="_blank" rel="noopener noreferrer">View the source on GitHub ↗</a>`}</article>`;
}
if (initial?.error) errorState(initial.error);
else if (path === '/') renderPicker();
else if (path.startsWith('/s/')) renderStack(initial);
else if (path === '/leaderboard') renderLeaderboard();
else if (path.startsWith('/apps/') && initial?.app) renderLeaderboard(initial.app);
else if (path === '/about' || path === '/privacy') infoPage(path === '/privacy');
else errorState('That page does not exist.');
const current = path === '/' ? $('[data-nav="pick"]') : path === '/leaderboard' ? $('[data-nav="leaderboard"]') : null;
current?.setAttribute('aria-current', 'page');
