import { llm } from './llm-adapter.js'

/* Circle of Control – single page app (no backend)
   Works in your Jekyll GOV.UK prototype kit.
   Flow (aligned to design brief):
   1) Capture situations (structured inputs, add/remove)
   2) Explore causality per situation (brief causes + optional evidence/assumption)
   3) Apply RAG by locus of control (Green/Amber/Red)
   4) Wrap-up (grouped by R/A/G, actions, circle visual) + export
*/

const $app = document.querySelector('[data-app]');
const STORAGE_KEY = 'cocStateV1';

const state = loadState() || {
  // We call them situations in the UI; keep key name for stability
  issues: [],              // [{ id, text, causesText?, whyBelief?, control?, nextAction? }]
  causes: {},              // legacy tree per situation (optional)
  agency: {},              // legacy mapping; we now use issue.control ('green'|'amber'|'red')
  step: 1,                 // 1 capture -> 2 causes -> 3 agency -> 4 review/export
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
let autosaveTimer = null;

// simple id
const uid = () => Math.random().toString(36).slice(2, 9);

// ---- Render helpers --------------------------------------------------------
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}

function render() {
  $app.innerHTML = '';
  const container = h('div', { class: 'coc-container' });

  container.appendChild(h('h1', { class: 'govuk-heading-l' }, 'Part 1: Explore together — Problem space analysis'));

  // step indicator
  container.appendChild(h('p', { class: 'govuk-body-s govuk-!-margin-bottom-2' }, `Step ${state.step} of 4`));

  // aria live region for feedback
  container.appendChild(h('div', { id: 'coc-live', class: 'coc-visually-hidden', role: 'status', 'aria-live': 'polite' }, ''));

  if (state.step === 1) container.appendChild(stepCapture());
  if (state.step === 2) container.appendChild(stepCauses());
  if (state.step === 3) container.appendChild(stepAgency());
  if (state.step === 4) container.appendChild(stepReview());

  // sticky action bar (Save draft / Back / Continue)
  container.appendChild(stickyBar());

  $app.appendChild(container);

  // Enhance GOV.UK components (radios, details, etc.) after render
  if (window.GOVUKFrontend && typeof window.GOVUKFrontend.initAll === 'function') {
    window.GOVUKFrontend.initAll({ scope: container });
  }

  // start autosave after first render
  startAutosave();
}

// ---- Step 1: capture situations -------------------------------------------
function stepCapture() {
  const card = h('div', { class: 'coc-card' });
  card.appendChild(h('h2', { class: 'govuk-heading-m' }, '1) Situations'));
  card.appendChild(h('p', { class: 'govuk-body' }, 'What’s not working? One idea per field, in their words.'));

  const list = h('div', { id: 'situation-list' });
  if (state.issues.length === 0) {
    state.issues.push({ id: uid(), text: '' });
  }

  state.issues.forEach((s) => {
    const wrap = h('div', { class: 'govuk-form-group', 'data-id': s.id }, [
      h('label', { class: 'govuk-label', for: `sit-${s.id}` }, 'Situation'),
      h('input', {
        class: 'govuk-input', id: `sit-${s.id}`, value: s.text,
        onInput: (e) => { s.text = e.target.value; saveDraft(); },
        onKeydown: (e) => {
          if (e.key === 'Enter' && !e.shiftKey && e.target.value.trim()) {
            e.preventDefault();
            state.issues.push({ id: uid(), text: '' });
            announce('Added another situation');
            render();
          }
        }
      }),
      h('div', { class: 'coc-actions' }, [
        h('button', {
          class: 'govuk-button govuk-button--secondary',
          onClick: () => { state.issues = state.issues.filter(x => x.id !== s.id); if (state.issues.length === 0) state.issues.push({ id: uid(), text: '' }); announce('Removed a situation'); render(); }
        }, 'Remove'),
        h('button', {
          class: 'govuk-button govuk-button--secondary',
          onClick: () => rephraseSituationUI(s)
        }, 'Rephrase')
      ])
    ]);
    list.appendChild(wrap);
  });
  card.appendChild(list);

  const controls = h('div', { class: 'coc-actions coc-no-print' }, [
    h('button', {
      class: 'govuk-button govuk-button--secondary',
      onClick: () => { state.issues.push({ id: uid(), text: '' }); announce('Added another situation'); render(); }
    }, 'Add another situation')
  ]);
  card.appendChild(controls);
  return card;
}

// ---- Step 2: Causality (brief notes per situation) ------------------------
function stepCauses() {
  const card = h('div', { class: 'coc-card' }, [
    h('h2', { class: 'govuk-heading-m' }, '2) Explore causality'),
    h('p', { class: 'govuk-body' }, 'For each situation, note causes and optional “why we think this is true”. Short, bulleted text is fine.')
  ]);

  state.issues.forEach(s => {
    const grp = h('div', { class: 'govuk-form-group' });
    grp.appendChild(h('h3', { class: 'govuk-heading-s' }, s.text || 'Untitled'));

    const causesTa = h('textarea', {
      class: 'govuk-textarea', rows: '3', id: `causes-${s.id}`,
      onInput: (e) => { s.causesText = e.target.value; saveDraft(); }
    });
    causesTa.value = s.causesText || '';
    grp.appendChild(h('label', { class: 'govuk-label', for: `causes-${s.id}` }, 'Why is this happening?'));
    grp.appendChild(causesTa);

    const whyTa = h('textarea', {
      class: 'govuk-textarea', rows: '2', id: `why-${s.id}`,
      onInput: (e) => { s.whyBelief = e.target.value; saveDraft(); }
    });
    whyTa.value = s.whyBelief || '';
    grp.appendChild(h('label', { class: 'govuk-label', for: `why-${s.id}` }, 'Why we think this is true (optional)'));
    grp.appendChild(whyTa);

    grp.appendChild(h('div', { class: 'coc-actions' }, [
      h('button', { class: 'govuk-button govuk-button--secondary', onClick: () => suggestCausesUI(s) }, 'Suggest causes')
    ]));

    card.appendChild(grp);
  });

  return card;
}

function renderCauseNode(issueId, node, depth) {
  const li = h('li', {}, [
    h('span', {}, node.text),
    h('div', { class: 'coc-actions coc-no-print' }, [
      h('input', { class: 'govuk-input', placeholder: 'Deeper cause…', id: `deep-${node.id}` }),
      h('button', {
        class: 'govuk-button govuk-button--secondary',
        onClick: () => {
          const input = document.getElementById(`deep-${node.id}`);
          const text = input.value.trim();
          if (!text) return;
          const child = { id: uid(), text, parentId: node.id };
          state.causes[issueId].push(child);
          input.value = '';
          render();
        }
      }, 'Add deeper cause')
    ])
  ]);

  // render children
  (state.causes[issueId] || [])
    .filter(n => n.parentId === node.id)
    .forEach(child => {
      const sub = h('ul', { class: 'govuk-list govuk-list--bullet', style: 'margin-top:8px;' });
      sub.appendChild(renderCauseNode(issueId, child, depth + 1));
      li.appendChild(sub);
    });

  return li;
}

// ---- Step 3: agency mapping ------------------------------------------------
function stepAgency() {
  const card = h('div', { class: 'coc-card' });
  card.appendChild(h('h2', { class: 'govuk-heading-m' }, '3) RAG by control'));
  card.appendChild(h('p', { class: 'govuk-hint' }, 'Pick one: Green – complete control; Amber – some influence; Red – no control.'));

  state.issues.forEach(s => {
    const fs = h('fieldset', { class: 'govuk-fieldset', style: 'margin-bottom:8px;' }, [
      h('legend', { class: 'govuk-fieldset__legend govuk-fieldset__legend--s' }, s.text || 'Untitled'),
      radiosGroup(s)
    ]);
    card.appendChild(fs);
  });

  card.appendChild(
    h('div', { class: 'coc-actions coc-no-print' }, [
      h('button', { class: 'govuk-button', onClick: () => { state.step = 4; render(); } }, 'Review & export')
    ])
  );

  return card;
}

function radiosGroup(situation) {
  const name = `agency-${situation.id}`;
  const values = [
    { v: 'green', label: 'Green — complete control' },
    { v: 'amber', label: 'Amber — some influence' },
    { v: 'red', label: 'Red — no control' }
  ];
  const group = h('div', { class: 'govuk-radios govuk-radios--small', 'data-module': 'govuk-radios' });
  values.forEach(({ v, label }) => {
    const id = `${name}-${v}`;
    const input = h('input', {
      class: 'govuk-radios__input', type: 'radio', name, id,
      checked: (situation.control || '') === v ? true : null,
      onChange: () => { situation.control = v; saveDraft(); }
    });
    const lbl = h('label', { class: 'govuk-label govuk-radios__label', for: id }, label);
    group.appendChild(h('div', { class: 'govuk-radios__item' }, [input, lbl]));
  });
  return group;
}

// ---- Step 4: review + circle + export -------------------------------------
function stepReview() {
  const wrap = h('div');

  // summary: three columns by R/A/G
  const columns = h('div', { class: 'govuk-grid-row' });
  const groups = {
    green: { title: 'Green — complete control', items: state.issues.filter(s => s.control === 'green') },
    amber: { title: 'Amber — some influence', items: state.issues.filter(s => s.control === 'amber') },
    red: { title: 'Red — no control', items: state.issues.filter(s => s.control === 'red') }
  };
  [
    ['one-third', 'green'],
    ['one-third', 'amber'],
    ['one-third', 'red']
  ].forEach(([span, key]) => {
    const col = h('div', { class: `govuk-grid-column-${span}` });
    const g = groups[key];
    col.appendChild(h('h3', { class: 'govuk-heading-s' }, g.title));
    if (!g.items.length) {
      col.appendChild(h('p', { class: 'govuk-body-s' }, '—'));
    } else {
      g.items.forEach(s => {
        col.appendChild(h('p', { class: 'govuk-body' }, s.text));
        // follow-up notes depending on group
        let label = 'Notes';
        if (key === 'green') label = 'Immediate actions';
        if (key === 'amber') label = 'How might we increase control?';
        if (key === 'red') label = 'Park / monitor note';
        const id = `next-${s.id}`;
        const ta = h('textarea', { class: 'govuk-textarea', rows: '3', id, onInput: (e) => { s.nextAction = e.target.value; saveDraft(); } });
        ta.value = s.nextAction || '';
        col.appendChild(h('label', { class: 'govuk-label', for: id }, label));
        col.appendChild(ta);
      });
    }
    columns.appendChild(col);
  });
  wrap.appendChild(h('div', { class: 'coc-card' }, [columns]));

  // circle visual
  wrap.appendChild(h('div', { class: 'coc-card coc-circle-wrap' }, [
    h('h3', { class: 'govuk-heading-s' }, 'Circle of control'),
    renderCircleSVG()
  ]));

  // export
  wrap.appendChild(
    h('div', { class: 'coc-actions coc-no-print' }, [
      h('button', { class: 'govuk-button', onClick: () => window.print() }, 'Export to PDF'),
      h('button', { class: 'govuk-button govuk-button--secondary', onClick: downloadJSON }, 'Download JSON'),
      h('button', { class: 'govuk-button govuk-button--secondary', onClick: downloadCSV }, 'Download CSV')
    ])
  );

  return wrap;
}

function renderCircleSVG() {
  // collect by RAG
  const control = state.issues.filter(s => s.control === 'green').map(s => s.text);
  const influence = state.issues.filter(s => s.control === 'amber').map(s => s.text);
  const none = state.issues.filter(s => s.control === 'red').map(s => s.text);

  // simple radial layout: we’ll just list text blocks inside each ring
  const svg = h('svg', { class: 'coc-svg', viewBox: '0 0 700 700', xmlns: 'http://www.w3.org/2000/svg' });

  // rings
  const rings = [
    { r: 220, fill: '#d6f5d6', label: 'I CONTROL' },
    { r: 320, fill: '#fff4bf', label: 'I CAN INFLUENCE' },
    { r: 340, fill: '#f3f2f1', label: 'OUTSIDE MY CONTROL' }
  ];
  // base circle (outermost backdrop)
  svg.appendChild(circle(350, 350, rings[2].r, '#f3f2f1', '#b1b4b6'));
  svg.appendChild(circle(350, 350, rings[1].r, '#fff4bf', '#b1b4b6'));
  svg.appendChild(circle(350, 350, rings[0].r, '#d6f5d6', '#b1b4b6'));

  // labels
  svg.appendChild(textAt(350, 345, rings[0].label, 'middle', 'bold'));
  svg.appendChild(textAt(350, 475, rings[1].label, 'middle', 'bold'));
  svg.appendChild(textAt(350, 40,  rings[2].label, 'middle', 'bold'));

  // place chips
  placeChips(svg, control, 350, 350, 0, rings[0].r - 30);
  placeChips(svg, influence, 350, 350, rings[0].r + 10, rings[1].r - 30);
  placeChips(svg, none, 350, 350, rings[1].r + 10, rings[2].r - 10);

  return svg;
}

function circle(cx, cy, r, fill, stroke) {
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
  c.setAttribute('fill', fill); c.setAttribute('stroke', stroke);
  return c;
}

function textAt(x, y, txt, anchor = 'start', weight = 'normal') {
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('x', x); t.setAttribute('y', y);
  t.setAttribute('text-anchor', anchor);
  t.setAttribute('font-family', 'GDS Transport, Arial, sans-serif');
  t.setAttribute('font-size', '16');
  t.setAttribute('font-weight', weight);
  t.textContent = txt;
  return t;
}

// distribute chips in a ring segment
function placeChips(svg, items, cx, cy, rMin, rMax) {
  if (!items.length) return;
  const startAngle = -Math.PI / 2; // top
  const endAngle = startAngle + 2 * Math.PI;
  const angleStep = (endAngle - startAngle) / Math.max(items.length, 1);

  items.forEach((txt, i) => {
    const angle = startAngle + i * angleStep;
    const r = rMin + ((rMax - rMin) * ((i % 3) / 3)); // simple staggering
    const x = cx + Math.cos(angle) * (rMax - 20);
    const y = cy + Math.sin(angle) * (rMax - 20);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const padX = 8, padY = 6;
    const t = textAt(x, y, txt, 'middle');
    t.setAttribute('class', 'coc-chip');

    // measure text by temp insertion
    svg.appendChild(t);
    const bbox = t.getBBox();
    svg.removeChild(t);

    bg.setAttribute('x', bbox.x - padX);
    bg.setAttribute('y', bbox.y - padY);
    bg.setAttribute('width', bbox.width + padX * 2);
    bg.setAttribute('height', bbox.height + padY * 2);
    bg.setAttribute('rx', 6); bg.setAttribute('ry', 6);
    bg.setAttribute('fill', '#ffffff'); bg.setAttribute('stroke', '#b1b4b6');

    svg.appendChild(bg);
    svg.appendChild(textAt(x, y, txt, 'middle'));
  });
}

function getTextById(id) {
  const issue = state.issues.find(i => i.id === id);
  if (issue) return issue.text;
  for (const arr of Object.values(state.causes)) {
    const node = arr.find(n => n.id === id);
    if (node) return node.text;
  }
  return '';
}

// bootstrap
render();

// sticky action bar
function stickyBar() {
  const bar = h('div', { class: 'coc-sticky' });
  const left = h('div');
  const right = h('div', { class: 'coc-actions' });
  left.appendChild(h('span', { class: 'govuk-body-s' }, 'Progress saved locally'));
  right.appendChild(h('button', { class: 'govuk-button govuk-button--secondary', onClick: saveDraft }, 'Save draft'));
  right.appendChild(h('button', { class: 'govuk-button govuk-button--secondary', onClick: backStep }, 'Back'));
  right.appendChild(h('button', { class: 'govuk-button', onClick: nextStep }, 'Continue'));
  bar.appendChild(left); bar.appendChild(right);
  return bar;
}

function nextStep() {
  if (state.step === 1) {
    state.issues = state.issues.map(s => ({ ...s, text: (s.text || '').trim() })).filter(s => s.text);
    if (!state.issues.length) { announce('Add at least one situation'); return; }
  }
  if (state.step === 3) {
    // all situations must have a control set
    const missing = state.issues.filter(s => !s.control).length;
    if (missing) { announce('Choose Green/Amber/Red for each situation'); return; }
  }
  state.step = Math.min(4, state.step + 1);
  render();
}

function backStep() {
  state.step = Math.max(1, state.step - 1);
  render();
}

// simple JSON export
function downloadJSON() {
  const data = {
    situations: state.issues.map(s => ({
      id: s.id,
      text: s.text,
      causes: s.causesText || '',
      why_belief: s.whyBelief || '',
      control: s.control || '',
      next_action: s.nextAction || ''
    })),
    createdAt: state.createdAt,
    updatedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'circle-of-control.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function downloadCSV() {
  const headers = ['id','text','causes','why_belief','control','next_action'];
  const rows = state.issues.map(s => [s.id, s.text, s.causesText||'', s.whyBelief||'', s.control||'', s.nextAction||'']);
  const escape = (v) => {
    const s = (v ?? '').toString();
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'circle-of-control.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// persistence
function saveDraft() {
  state.updatedAt = new Date().toISOString();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // basic shape guard
    if (!s || typeof s !== 'object' || !Array.isArray(s.issues)) return null;
    return s;
  } catch { return null; }
}
function startAutosave() {
  if (autosaveTimer) return;
  autosaveTimer = setInterval(saveDraft, 3000);
}

function announce(msg) {
  const live = document.getElementById('coc-live');
  if (live) { live.textContent = msg; }
}

// UI helpers for LLM actions -------------------------------------------------
async function rephraseSituationUI(situation) {
  try {
    const suggestions = await llm.rephraseSituation(situation.text || '');
    showChooser('Rephrase suggestions', suggestions, choice => {
      situation.text = choice; saveDraft(); render();
    });
  } catch (e) {
    alert('Could not get rephrase suggestions.');
    // eslint-disable-next-line no-console
    console.error(e);
  }
}

async function suggestCausesUI(situation) {
  try {
    const suggestions = await llm.suggestCauses(situation.text || '');
    if (!suggestions.length) { alert('No suggestions available.'); return; }
    const bullets = suggestions.map(s => `• ${s}`).join('\n');
    const sep = situation.causesText && !situation.causesText.endsWith('\n') ? '\n' : '';
    situation.causesText = (situation.causesText || '') + sep + bullets + '\n';
    saveDraft(); render();
  } catch (e) {
    alert('Could not get cause suggestions.');
    // eslint-disable-next-line no-console
    console.error(e);
  }
}

function showChooser(title, options, onPick) {
  const chooser = document.createElement('div');
  chooser.setAttribute('class', 'coc-card');
  chooser.style.position = 'fixed';
  chooser.style.bottom = '16px';
  chooser.style.right = '16px';
  chooser.style.maxWidth = '420px';
  chooser.style.zIndex = '1000';
  chooser.appendChild(h('h3', { class: 'govuk-heading-s' }, title));
  const list = h('ul', { class: 'govuk-list govuk-list--bullet' });
  options.forEach(opt => {
    const li = h('li', {} , [
      h('button', { class: 'govuk-button govuk-button--secondary', onClick: () => { onPick(opt); document.body.removeChild(chooser); } }, opt)
    ]);
    list.appendChild(li);
  });
  chooser.appendChild(list);
  const close = h('button', { class: 'govuk-button govuk-button--secondary', onClick: () => document.body.removeChild(chooser) }, 'Close');
  chooser.appendChild(close);
  document.body.appendChild(chooser);
}
