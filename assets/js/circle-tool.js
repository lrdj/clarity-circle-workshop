// Circle of Control – list-based "add another" pattern with nested loops.
// Works in Jekyll + GOV.UK prototype kit (unbranded layout).

const appEl = document.querySelector('[data-app]');

if (appEl) {
  const state = { issues: [], causes: {}, agency: {}, step: 1 };
  const uid = () => Math.random().toString(36).slice(2, 9);

  // Tiny hyperscript helper with robust event binding
  const h = (tag, attrs = {}, children = []) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  };

  function render() {
    appEl.innerHTML = '';
    const container = h('div', { class: 'coc-container' });
    container.appendChild(h('h1', { class: 'govuk-heading-l' }, 'Circle of control'));
    if (state.step === 1) container.appendChild(step1());
    if (state.step === 2) container.appendChild(step2());
    if (state.step === 3) container.appendChild(step3());
    if (state.step === 4) container.appendChild(step4());
    appEl.appendChild(container);
  }

  // ---------- Step 1: Add situations (add-many pattern) ----------
  function step1() {
    const card = h('div', { class: 'coc-card' });
    card.appendChild(h('h2', { class: 'govuk-heading-m' }, '1) What’s not working?'));
    card.appendChild(h('p', { class: 'govuk-body' }, 'Add one situation at a time. Press Enter to add.'));

    const input = h('input', { class: 'govuk-input', placeholder: 'e.g. Deadlines shift without warning', id: 'issue-input' });
    const add = () => {
      const text = input.value.trim();
      if (!text) return;
      state.issues.push({ id: uid(), text });
      input.value = '';
      render();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

    const addBtn = h('button', { type: 'button', class: 'govuk-button govuk-button--secondary', onClick: add }, 'Add situation');
    card.appendChild(h('div', { class: 'coc-actions' }, [input, addBtn]));

    if (!state.issues.length) {
      card.appendChild(h('p', { class: 'govuk-hint' }, 'You can add multiple situations before continuing.'));
    }

    const ul = h('ul', { class: 'govuk-list govuk-list--bullet' });
    state.issues.forEach((i, idx) => {
      // edit control
      const editInput = h('input', { class: 'govuk-input', value: i.text, id: `issue-${i.id}` });
      editInput.addEventListener('change', () => {
        i.text = editInput.value.trim();
      });
      const del = h('button', {
        type: 'button', class: 'govuk-button govuk-button--warning coc-no-print',
        onClick: () => {
          // remove issue and its causes
          state.issues.splice(idx, 1);
          delete state.causes[i.id];
          // clean any agency assignments on removed nodes
          Object.keys(state.agency).forEach(k => {
            if (k === i.id) delete state.agency[k];
          });
          render();
        }
      }, 'Remove');

      ul.appendChild(h('li', {}, [
        h('div', { class: 'coc-actions' }, [editInput, del])
      ]));
    });
    card.appendChild(ul);

    // ensure causes store is ready
    state.issues.forEach(i => { if (!state.causes[i.id]) state.causes[i.id] = []; });

    card.appendChild(h('div', { class: 'coc-actions coc-no-print' }, [
      h('button', {
        type: 'button', class: 'govuk-button',
        onClick: () => { if (!state.issues.length) return; state.step = 2; render(); }
      }, 'Continue')
    ]));
    return card;
  }

  // ---------- Step 2: For each situation, add causes; for each cause, add deeper causes ----------
  function step2() {
    const card = h('div', { class: 'coc-card' });
    card.appendChild(h('h2', { class: 'govuk-heading-m' }, '2) Why is that happening?'));
    card.appendChild(h('p', { class: 'govuk-body' }, 'Add one or more causes per situation. Then, for any cause, add deeper causes (ask “why?” again).'));

    state.issues.forEach(issue => {
      card.appendChild(h('h3', { class: 'govuk-heading-s' }, `Issue: ${issue.text}`));

      // Add top-level cause (add-many)
      const causeInput = h('input', {
        class: 'govuk-input',
        placeholder: 'Because… (add a cause)',
        'aria-label': `Add cause for: ${issue.text}`
      });
      const addCause = () => {
        const text = causeInput.value.trim();
        if (!text) return;
        state.causes[issue.id].push({ id: uid(), text, parentId: null });
        causeInput.value = '';
        render();
      };
      causeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCause(); } });
      const addCauseBtn = h('button', { type: 'button', class: 'govuk-button govuk-button--secondary', onClick: addCause }, 'Add cause');
      card.appendChild(h('div', { class: 'coc-actions' }, [causeInput, addCauseBtn]));

      // Render cause tree (nested add-many)
      const ul = h('ul', { class: 'coc-list govuk-list govuk-list--bullet' });
      (state.causes[issue.id] || [])
        .filter(n => !n.parentId)
        .forEach(node => ul.appendChild(renderCauseNode(issue.id, node)));
      card.appendChild(ul);
    });

    card.appendChild(h('div', { class: 'coc-actions coc-no-print' }, [
      h('button', { type: 'button', class: 'govuk-button', onClick: () => { state.step = 3; render(); } }, 'Continue to agency'),
      h('button', { type: 'button', class: 'govuk-button govuk-button--secondary', onClick: () => { state.step = 1; render(); } }, 'Back')
    ]));
    return card;
  }

  function renderCauseNode(issueId, node) {
    // node line: editable text + remove + add deeper
    const line = h('div', { class: 'coc-actions' });
    const txt = h('input', { class: 'govuk-input', value: node.text, id: `node-${node.id}`, 'aria-label': `Edit cause: ${node.text}` });
    txt.addEventListener('change', () => { node.text = txt.value.trim(); });

    const rm = h('button', {
      type: 'button', class: 'govuk-button govuk-button--warning',
      onClick: () => {
        // remove node and its descendants
        const all = state.causes[issueId];
        const removeRec = (id) => {
          // remove children first
          all.filter(n => n.parentId === id).forEach(c => removeRec(c.id));
          const idx = all.findIndex(n => n.id === id);
          if (idx > -1) all.splice(idx, 1);
          // clear agency if any
          if (state.agency[id]) delete state.agency[id];
        };
        removeRec(node.id);
        render();
      }
    }, 'Remove');

    // add deeper cause (add-many)
    const deepInput = h('input', {
      class: 'govuk-input', placeholder: 'Deeper cause…', id: `deep-${node.id}`,
      'aria-label': `Add deeper cause for: ${node.text}`
    });
    const addDeep = () => {
      const text = deepInput.value.trim(); if (!text) return;
      state.causes[issueId].push({ id: uid(), text, parentId: node.id });
      deepInput.value = '';
      render();
    };
    deepInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addDeep(); } });
    const deepBtn = h('button', { type: 'button', class: 'govuk-button govuk-button--secondary', onClick: addDeep }, 'Add deeper cause');

    line.appendChild(txt);
    line.appendChild(rm);
    line.appendChild(deepInput);
    line.appendChild(deepBtn);

    const li = h('li', {}, [line]);

    // children
    (state.causes[issueId] || [])
      .filter(n => n.parentId === node.id)
      .forEach(child => {
        const sub = h('ul', { class: 'coc-list govuk-list govuk-list--bullet', style: 'margin-top:8px;' });
        sub.appendChild(renderCauseNode(issueId, child));
        li.appendChild(sub);
      });

    return li;
  }

  // ---------- Step 3: Agency tagging ----------
  function step3() {
    const card = h('div', { class: 'coc-card' });
    card.appendChild(h('h2', { class: 'govuk-heading-m' }, '3) Map control, influence, or outside'));

    const nodes = [
      ...state.issues.map(i => ({ id: i.id, text: i.text })),
      ...Object.values(state.causes).flatMap(arr => arr.map(n => ({ id: n.id, text: n.text })))
    ];
    if (!nodes.length) {
      card.appendChild(h('p', { class: 'govuk-hint' }, 'Add at least one situation in Step 1.'));
    }

    nodes.forEach(n => {
      const fs = h('fieldset', { class: 'govuk-fieldset', style: 'margin-bottom:8px;' }, [
        h('legend', { class: 'govuk-fieldset__legend govuk-fieldset__legend--s' }, n.text),
        radio(n.id, 'control', 'I control this'),
        radio(n.id, 'influence', 'I can influence this'),
        radio(n.id, 'none', 'Outside my control'),
      ]);
      card.appendChild(fs);
    });

    card.appendChild(h('div', { class: 'coc-actions coc-no-print' }, [
      h('button', { type: 'button', class: 'govuk-button', onClick: () => { state.step = 4; render(); } }, 'Review & export'),
      h('button', { type: 'button', class: 'govuk-button govuk-button--secondary', onClick: () => { state.step = 2; render(); } }, 'Back')
    ]));
    return card;
  }

  function radio(nodeId, value, label) {
    const name = `agency-${nodeId}`;
    const input = h('input', {
      class: 'govuk-radios__input',
      type: 'radio',
      name,
      id: `${name}-${value}`,
      checked: (state.agency[nodeId] || '') === value ? true : null,
      onChange: () => { state.agency[nodeId] = value; }
    });
    const lbl = h('label', { class: 'govuk-label govuk-radios__label', for: `${name}-${value}` }, label);
    return h('div', { class: 'govuk-radios govuk-radios--small' }, [
      h('div', { class: 'govuk-radios__item' }, [input, lbl])
    ]);
  }

  // ---------- Step 4: Review + SVG circle + export ----------
  function step4() {
    const wrap = h('div');

    wrap.appendChild(h('div', { class: 'coc-card' }, [
      h('h2', { class: 'govuk-heading-m' }, '4) Summary & export'),
      h('p', { class: 'govuk-body' }, 'Check items are in the right circle, then export to PDF.'),
    ]));

    wrap.appendChild(h('div', { class: 'coc-card coc-circle-wrap' }, [
      h('h3', { class: 'govuk-heading-s' }, 'Circle of control'),
      renderSVG()
    ]));

    wrap.appendChild(h('div', { class: 'coc-actions coc-no-print' }, [
      h('button', { type: 'button', class: 'govuk-button', onClick: () => window.print() }, 'Export to PDF'),
      h('button', { type: 'button', class: 'govuk-button govuk-button--secondary', onClick: () => { state.step = 3; render(); } }, 'Back')
    ]));

    return wrap;
  }

  // SVG rendering
  function renderSVG() {
    const entries = Object.entries(state.agency);

    const getText = (id) => {
      const issue = state.issues.find(i => i.id === id);
      if (issue) return issue.text;
      for (const arr of Object.values(state.causes)) {
        const node = arr.find(n => n.id === id);
        if (node) return node.text;
      }
      return '';
    };

    const control = entries.filter(([, v]) => v === 'control').map(([id]) => getText(id));
    const influence = entries.filter(([, v]) => v === 'influence').map(([id]) => getText(id));
    const none = entries.filter(([, v]) => v === 'none').map(([id]) => getText(id));

    const svg = h('svg', { class: 'coc-svg', viewBox: '0 0 700 700', xmlns: 'http://www.w3.org/2000/svg' });

    const circle = (cx, cy, r, fill, stroke) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
      c.setAttribute('fill', fill); c.setAttribute('stroke', stroke);
      return c;
    };

    const textAt = (x, y, txt, anchor = 'start', weight = 'normal') => {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('text-anchor', anchor);
      t.setAttribute('font-family', 'GDS Transport, Arial, sans-serif');
      t.setAttribute('font-size', '16');
      t.setAttribute('font-weight', weight);
      t.textContent = txt;
      return t;
    };

    const placeChips = (items, rMin, rMax) => {
      if (!items.length) return;
      const start = -Math.PI / 2, end = start + 2 * Math.PI;
      const step = (end - start) / Math.max(items.length, 1);
      items.forEach((txt, i) => {
        const angle = start + i * step;
        const r = rMin + ((rMax - rMin) * ((i % 3) / 3)); // simple staggering
        const x = 350 + Math.cos(angle) * (rMax - 20);
        const y = 350 + Math.sin(angle) * (rMax - 20);

        // measure text to draw a background bubble
        const t = textAt(x, y, txt, 'middle'); t.setAttribute('class', 'coc-chip');
        svg.appendChild(t);
        const bbox = t.getBBox(); svg.removeChild(t);

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', bbox.x - 8); bg.setAttribute('y', bbox.y - 6);
        bg.setAttribute('width', bbox.width + 16); bg.setAttribute('height', bbox.height + 12);
        bg.setAttribute('rx', 6); bg.setAttribute('ry', 6);
        bg.setAttribute('fill', '#ffffff'); bg.setAttribute('stroke', '#b1b4b6');

        svg.appendChild(bg);
        svg.appendChild(textAt(x, y, txt, 'middle'));
      });
    };

    // Rings
    svg.appendChild(circle(350, 350, 340, '#f3f2f1', '#b1b4b6')); // outer
    svg.appendChild(circle(350, 350, 320, '#fff4bf', '#b1b4b6')); // influence
    svg.appendChild(circle(350, 350, 220, '#d6f5d6', '#b1b4b6')); // control

    svg.appendChild(textAt(350, 345, 'I CONTROL', 'middle', 'bold'));
    svg.appendChild(textAt(350, 475, 'I CAN INFLUENCE', 'middle', 'bold'));
    svg.appendChild(textAt(350, 40, 'OUTSIDE MY CONTROL', 'middle', 'bold'));

    // Chips
    placeChips(control, 0, 190);
    placeChips(influence, 230, 300);
    placeChips(none, 330, 340);

    return svg;
  }

  // initial render
  render();
}
