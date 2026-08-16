/**
 * Builds the Stitch prompt pack artifact from docs/stitch-ui-prompts.md.
 *
 * Generating the page from the markdown keeps the two from drifting: the repo
 * doc stays the source of truth and this only handles presentation.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const md = readFileSync(process.argv[2], 'utf8');
const out = process.argv[3];

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Minimal inline markdown: links, bold, code. */
const inline = (s) =>
  esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Runs after bold, so a lone * is unambiguous.
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

// Split into sections on H2.
const parts = md.split(/^## /m);
const preamble = parts.shift();
const sections = parts.map((raw) => {
  const nl = raw.indexOf('\n');
  const heading = raw.slice(0, nl).trim();
  const body = raw.slice(nl + 1);

  const m = heading.match(/^(S0|P\d+|N\d+|X\d+)\s+—\s+(.*)$/);
  const id = m ? m[1] : null;
  let title = m ? m[2] : heading;

  let isNew = false;
  if (/\*\*NEW\*\*/.test(title)) {
    isNew = true;
    title = title.replace(/\s*\*\*NEW\*\*/, '').trim();
  }

  const promptMatch = body.match(/```prompt\n([\s\S]*?)```/);
  const prompt = promptMatch ? promptMatch[1].replace(/\s+$/, '') : null;

  // Purpose runs until the next blank line. Note the lookahead can't use `$`:
  // under /m that matches every line end, truncating multi-line purposes.
  const purposeMatch = body.match(/^Purpose:\s*([\s\S]*?)(?=\n[ \t]*\n)/m);
  const purpose = purposeMatch ? purposeMatch[1].replace(/\n/g, ' ').trim() : null;

  // Prose = everything that isn't the prompt block or the purpose line.
  const prose = body
    .replace(/```prompt\n[\s\S]*?```/g, '')
    .replace(/^Purpose:[\s\S]*?(?=\n[ \t]*\n)/m, '')
    .replace(/^---$/gm, '')
    .trim();

  return { id, title, isNew, purpose, prompt, prose, group: id ? id[0] : null };
});

/** Renders a prose chunk: paragraphs, bullet lists and ordered lists. */
function renderProse(text) {
  if (!text) return '';
  const blocks = text.split(/\n{2,}/);
  return blocks
    .map((b) => {
      const lines = b.split('\n');
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return `<ul>${lines
          .map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`)
          .join('')}</ul>`;
      }
      if (lines.every((l) => /^\s*\d+\.\s+/.test(l) || /^\s{2,}/.test(l))) {
        const items = b.split(/\n(?=\s*\d+\.\s)/);
        return `<ol>${items
          .map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, '').replace(/\n\s+/g, ' '))}</li>`)
          .join('')}</ol>`;
      }
      return `<p>${inline(b.replace(/\n/g, ' '))}</p>`;
    })
    .join('\n');
}

const groupLabel = { S: 'Foundation', P: 'Screens', N: 'Notifications', X: 'Cross-cutting' };

// Table of contents, grouped.
const toc = [];
let lastGroup = null;
for (const s of sections) {
  if (!s.id) continue;
  if (s.group !== lastGroup) {
    toc.push(`<li class="toc-group">${groupLabel[s.group] ?? ''}</li>`);
    lastGroup = s.group;
  }
  toc.push(
    `<li><a href="#${s.id}"><span class="toc-id">${s.id}</span>${esc(s.title)}${
      s.isNew ? '<span class="toc-new">NEW</span>' : ''
    }</a></li>`,
  );
}

const promptCount = sections.filter((s) => s.prompt).length;
const newCount = sections.filter((s) => s.isNew).length;

const body = sections
  .map((s) => {
    if (!s.id) {
      return `<section class="plain" id="${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">
        <h2>${esc(s.title)}</h2>
        ${renderProse(s.prose)}
      </section>`;
    }
    return `<section class="card" id="${s.id}">
      <header class="card-head">
        <div class="card-meta">
          <span class="chip chip-${s.group}">${s.id}</span>
          ${s.isNew ? '<span class="chip chip-new">NEW SCREEN</span>' : ''}
        </div>
        <h2>${esc(s.title)}</h2>
        ${s.purpose ? `<p class="purpose">${inline(s.purpose)}</p>` : ''}
        ${renderProse(s.prose)}
      </header>
      ${
        s.prompt
          ? `<div class="prompt">
               <div class="prompt-bar">
                 <span class="prompt-label">Prompt</span>
                 <button class="copy" type="button" data-copy>Copy</button>
               </div>
               <pre><code>${esc(s.prompt)}</code></pre>
             </div>`
          : ''
      }
    </section>`;
  })
  .join('\n');

const html = `<title>Waypoint Stitch Prompt Pack</title>
<style>
  /* Light is the base. Every colour is a token so the three theme states
     (explicit light, explicit dark, and un-stamped system) all resolve. */
  :root {
    --paper:   #F4F6F9;
    --surface: #FFFFFF;
    --sunken:  #EDF0F4;
    --rule:    #E1E6EC;
    --rule-strong: #CFD6DF;
    --ink:     #0C111D;
    --muted:   #5D6B82;
    --faint:   #93A0B4;
    --accent:  #2563EB;
    --accent-soft: #EAF0FE;
    --code-bg: #0E1521;
    --code-ink:#DCE5F2;
    --code-dim:#8A9BB4;
    --new:     #B54708;
    --new-soft:#FFF6ED;
    --shadow:  0 1px 2px rgba(12,17,29,.04), 0 8px 24px rgba(12,17,29,.05);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper:   #0B0F17;
      --surface: #141A24;
      --sunken:  #1C232F;
      --rule:    #263041;
      --rule-strong: #33405499;
      --ink:     #F2F5F9;
      --muted:   #9AA8BD;
      --faint:   #6B7A90;
      --accent:  #6D9BFF;
      --accent-soft: #16233C;
      --code-bg: #080C13;
      --code-ink:#DCE5F2;
      --code-dim:#7C8DA6;
      --new:     #F79009;
      --new-soft:#2A1F0C;
      --shadow:  0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
    }
  }
  :root[data-theme="dark"] {
    --paper:   #0B0F17;
    --surface: #141A24;
    --sunken:  #1C232F;
    --rule:    #263041;
    --rule-strong: #33405499;
    --ink:     #F2F5F9;
    --muted:   #9AA8BD;
    --faint:   #6B7A90;
    --accent:  #6D9BFF;
    --accent-soft: #16233C;
    --code-bg: #080C13;
    --code-ink:#DCE5F2;
    --code-dim:#7C8DA6;
    --new:     #F79009;
    --new-soft:#2A1F0C;
    --shadow:  0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
                 "Helvetica Neue", Arial, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  .wrap {
    max-width: 1240px;
    margin: 0 auto;
    padding: 0 24px 96px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 40px;
  }
  @media (min-width: 1080px) {
    .wrap { grid-template-columns: 236px minmax(0, 1fr); }
    nav.toc { align-self: stretch; }
  }

  /* ---------- masthead ---------- */
  header.masthead {
    grid-column: 1 / -1;
    padding: 72px 0 40px;
    border-bottom: 1px solid var(--rule);
    margin-bottom: 8px;
  }
  .eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 0 0 14px;
  }
  h1 {
    font-size: clamp(34px, 5.4vw, 52px);
    line-height: 1.06;
    letter-spacing: -.03em;
    font-weight: 800;
    margin: 0 0 18px;
    text-wrap: balance;
  }
  .standfirst {
    font-size: 18px;
    line-height: 1.55;
    color: var(--muted);
    max-width: 62ch;
    margin: 0 0 28px;
  }
  .stats { display: flex; flex-wrap: wrap; gap: 32px; }
  .stat-n {
    font-size: 26px; font-weight: 700; letter-spacing: -.02em;
    font-variant-numeric: tabular-nums; display: block;
  }
  .stat-l {
    font-size: 12px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: var(--faint);
  }

  /* ---------- toc ---------- */
  nav.toc { display: none; }
  @media (min-width: 1080px) {
    nav.toc { display: block; }
    nav.toc > ul {
      position: sticky;
      top: 24px;
      max-height: calc(100vh - 48px);
      overflow-y: auto;
      font-size: 13.5px;
      padding-right: 8px;
    }
    nav.toc ul { list-style: none; margin: 0; padding: 0; }
    nav.toc li { margin: 0; }
    nav.toc a {
      display: flex; gap: 8px; align-items: baseline;
      padding: 5px 0; color: var(--muted); text-decoration: none;
      border-radius: 4px;
    }
    nav.toc a:hover { color: var(--accent); }
    .toc-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px; color: var(--faint); min-width: 26px; font-weight: 600;
    }
    .toc-group {
      font-size: 11px; font-weight: 700; letter-spacing: .1em;
      text-transform: uppercase; color: var(--faint);
      margin: 22px 0 6px; padding-bottom: 5px;
      border-bottom: 1px solid var(--rule);
    }
    .toc-group:first-child { margin-top: 0; }
    .toc-new {
      font-size: 9px; font-weight: 700; letter-spacing: .06em;
      color: var(--new); border: 1px solid currentColor;
      border-radius: 3px; padding: 0 3px; margin-left: 2px;
    }
  }

  main { min-width: 0; display: flex; flex-direction: column; gap: 28px; }

  /* ---------- sections ---------- */
  section.plain { max-width: 74ch; }
  section.plain h2 {
    font-size: 26px; letter-spacing: -.02em; font-weight: 700;
    margin: 32px 0 14px;
  }

  section.card {
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: 14px;
    box-shadow: var(--shadow);
    overflow: hidden;
    scroll-margin-top: 24px;
  }
  .card-head { padding: 26px 26px 20px; }
  .card-meta { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
  .chip {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px; font-weight: 700; letter-spacing: .06em;
    padding: 3px 8px; border-radius: 999px;
    background: var(--accent-soft); color: var(--accent);
  }
  .chip-new {
    background: var(--new-soft); color: var(--new);
    font-family: inherit; letter-spacing: .08em;
  }
  section.card h2 {
    font-size: 23px; letter-spacing: -.022em; font-weight: 700;
    margin: 0 0 10px; text-wrap: balance;
  }
  .purpose {
    color: var(--muted); margin: 0 0 4px; max-width: 68ch;
    font-size: 15.5px;
  }
  .card-head p { margin: 0 0 12px; max-width: 68ch; }
  .card-head p:last-child { margin-bottom: 0; }
  .card-head ul, .card-head ol { max-width: 68ch; margin: 0 0 12px; padding-left: 22px; }
  .card-head li { margin: 5px 0; }

  section.plain p, section.plain li { max-width: 74ch; }
  section.plain ul, section.plain ol { padding-left: 22px; }
  section.plain li { margin: 7px 0; }

  a { color: var(--accent); }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: .88em;
    background: var(--sunken);
    border-radius: 4px;
    padding: 1px 5px;
  }
  strong { font-weight: 650; }

  /* ---------- prompt block ---------- */
  .prompt { border-top: 1px solid var(--rule); background: var(--code-bg); }
  .prompt-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px 10px 18px;
    border-bottom: 1px solid rgba(255,255,255,.07);
  }
  .prompt-label {
    font-size: 11px; font-weight: 700; letter-spacing: .12em;
    text-transform: uppercase; color: var(--code-dim);
  }
  .copy {
    font: inherit; font-size: 12.5px; font-weight: 600;
    color: var(--code-ink);
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 7px; padding: 5px 13px; cursor: pointer;
    transition: background .15s ease;
  }
  .copy:hover { background: rgba(255,255,255,.16); }
  .copy:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .copy[data-done="1"] { color: #7EE2AC; border-color: #7EE2AC55; }
  .prompt pre {
    margin: 0; padding: 20px 18px 24px;
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12.8px; line-height: 1.62;
    color: var(--code-ink);
    tab-size: 2;
  }
  .prompt pre code { background: none; padding: 0; font-size: inherit; }

  /* Quality bar reads as a checklist, so give it a little more presence. */
  #quality-bar h2 { font-size: 30px; }
  #quality-bar ul { list-style: none; padding-left: 0; }
  #quality-bar li {
    padding-left: 26px; position: relative; margin: 9px 0;
  }
  #quality-bar li::before {
    content: "";
    position: absolute; left: 4px; top: .62em;
    width: 7px; height: 7px; border-radius: 2px;
    background: var(--accent);
  }

  footer.end {
    grid-column: 1 / -1;
    border-top: 1px solid var(--rule);
    margin-top: 24px; padding-top: 22px;
    font-size: 13.5px; color: var(--faint);
    max-width: 74ch;
  }

  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
    html { scroll-behavior: auto; }
  }
  html { scroll-behavior: smooth; }
</style>

<div class="wrap">
  <header class="masthead">
    <p class="eyebrow">Waypoint · Design brief</p>
    <h1>Stitch Prompt Pack</h1>
    <p class="standfirst">
      Paste-ready prompts for Google Stitch covering every screen, state,
      notification and cross-cutting concern in Waypoint — a trip planner where
      the whole product is answering one question: am I overspending?
    </p>
    <div class="stats">
      <div><span class="stat-n">${promptCount}</span><span class="stat-l">Prompts</span></div>
      <div><span class="stat-n">${newCount}</span><span class="stat-l">New screens</span></div>
      <div><span class="stat-n">5</span><span class="stat-l">Push types</span></div>
      <div><span class="stat-n">2</span><span class="stat-l">Themes</span></div>
    </div>
  </header>

  <nav class="toc" aria-label="Contents"><ul>${toc.join('')}</ul></nav>

  <main>${body}</main>

  <footer class="end">
    Source of truth lives at <code>docs/stitch-ui-prompts.md</code> in the
    Waypoint repo. Colour values, type scale and component specs are taken from
    the app's real design tokens (<code>src/theme.ts</code>), so anything
    designed from these prompts drops onto the existing build without
    retranslation.
  </footer>
</div>

<script>
  for (const btn of document.querySelectorAll('[data-copy]')) {
    btn.addEventListener('click', async () => {
      const text = btn.closest('.prompt').querySelector('code').innerText;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
      }
      btn.textContent = 'Copied';
      btn.dataset.done = '1';
      setTimeout(() => { btn.textContent = 'Copy'; delete btn.dataset.done; }, 1600);
    });
  }
</script>
`;

writeFileSync(out, html);
console.log('wrote', out, `${promptCount} prompts, ${newCount} new`);
