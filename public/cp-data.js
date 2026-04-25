// Shared utilities and data layer for The Commonplace
// Loads opps.json, normalizes, and exposes helpers + a tiny store.

(function (global) {
  const TODAY = new Date('2026-04-25');

  function parseDate(s) {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function dayDiff(d) {
    if (!d) return null;
    return Math.round((d - TODAY) / 86400000);
  }

  function fmtMoney(v) {
    if (v == null) return null;
    if (v === 0) return 'Free';
    if (v >= 1000) return v % 1000 === 0 ? '$' + v / 1000 + 'K' : '$' + (v / 1000).toFixed(1) + 'K';
    return '$' + v.toLocaleString();
  }

  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function fmtDate(d, mode = 'short') {
    if (!d) return 'rolling';
    if (mode === 'short') return MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate();
    if (mode === 'med') return MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    if (mode === 'long') return MONTHS_LONG[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    if (mode === 'numeric') return (d.getMonth()+1) + '.' + d.getDate();
    return d.toString();
  }

  // Estimate the *effort* of an application — used for "time-aware" sort
  function estimateEffort(opp) {
    const desc = (opp.description || '').toLowerCase();
    const types = (opp.writing_types || '').toLowerCase();
    let hours = 2;
    if (/novel|manuscript|book[- ]length|full[- ]length/.test(desc)) hours += 6;
    if (/excerpt|chapter/.test(desc)) hours += 3;
    if (/portfolio|sample/.test(desc)) hours += 2;
    if (/personal statement|artist statement|project statement|bio/.test(desc)) hours += 1;
    if (/letter[s]? of recommendation|reference/.test(desc)) hours += 4;
    if (opp.opportunity_type === 'residency') hours += 3;
    if (opp.opportunity_type === 'fellowship') hours += 5;
    if (/flash|micro|250|500 words|750 words/.test(desc + ' ' + types)) hours = Math.min(hours, 1);
    if (/single poem|one poem|three poems|3 poems|5 poems|six poems/.test(desc)) hours = Math.min(hours, 2);
    return Math.max(1, Math.round(hours));
  }

  function effortLabel(h) {
    if (h <= 1) return 'an afternoon';
    if (h <= 3) return 'a day';
    if (h <= 6) return 'a weekend';
    if (h <= 10) return 'a week';
    return 'serious work';
  }

  // Normalize one record
  function normalize(o) {
    const d = parseDate(o.deadline_date);
    const effort = estimateEffort(o);
    const genres = (o.writing_types || '')
      .split(/[,;/]|\band\b/i)
      .map(s => s.trim())
      .filter(s => s.length > 1);
    return {
      ...o,
      _date: d,
      _days: dayDiff(d),
      _effort: effort,
      _effortLabel: effortLabel(effort),
      _genres: genres,
      _money: fmtMoney(o.award_amount_numeric),
      _fee: o.entry_fee_numeric === 0 ? 'Free' : fmtMoney(o.entry_fee_numeric),
      _isFree: o.entry_fee_numeric === 0,
    };
  }

  // Load + filter to genuinely future-or-rolling
  let _data = null;
  async function loadOpps() {
    if (_data) return _data;
    const r = await fetch('opps.json');
    const raw = await r.json();
    const all = raw.map(normalize);
    // Show items with future deadlines OR rolling (no deadline_date)
    const live = all.filter(o => !o._date || o._date >= TODAY);
    _data = live;
    return _data;
  }

  // ───── Local storage state ─────
  const STORE_KEY = 'commonplace_state_v1';
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (_) { return {}; }
  }
  function saveState(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

  // Default seed state — gives the prototype life on first load
  function seedState() {
    return {
      writer: {
        name: 'Mira Okonkwo',
        pronouns: 'she/they',
        location: 'Pittsburgh, PA',
        stage: 'emerging',  // emerging | mid-career | established
        publications: 'magazines',
        identities: ['BIPOC', 'woman'],
        budget_year: 200,  // dollars set aside for fees
      },
      projects: [
        {
          id: 'p1',
          title: 'The Salt House',
          form: 'novel',
          genre: 'literary fiction',
          status: 'second draft',
          words: 64000,
          synopsis: 'A grief-haunted novel about a Nigerian-American family who inherit a crumbling salt-evaporation house on the Adriatic coast. A daughter, an ailing father, and a year of preserving things.',
          themes: ['inheritance', 'diaspora', 'grief', 'water', 'family'],
          excerpt_ready: true,
          color: 'oxblood',
        },
        {
          id: 'p2',
          title: 'How to Salt Tomatoes',
          form: 'essay collection',
          genre: 'creative nonfiction',
          status: 'in progress',
          words: 18000,
          synopsis: 'Essays on food, kitchens, mothers, and the small inheritances that survive borders. Eleven essays so far; aiming for fifteen.',
          themes: ['food', 'mothers', 'immigration', 'memory'],
          excerpt_ready: true,
          color: 'moss',
        },
        {
          id: 'p3',
          title: 'Field Notes from a Fever',
          form: 'poems',
          genre: 'poetry',
          status: 'collecting',
          words: 0,
          synopsis: 'A loose chapbook gathering — poems from a long illness. About thirty pages, still arranging.',
          themes: ['illness', 'body', 'time'],
          excerpt_ready: true,
          color: 'indigo',
        },
      ],
      ledger: [
        // Past submissions, mocked but realistic
        { id: 'l1', oppId: null, title: 'Iowa Review Tim McGinnis Award', org: 'The Iowa Review', date: '2024-01-12', fee: 20, status: 'rejected', project: 'p1', notes: 'No reply for 7 months, then a form rejection.' },
        { id: 'l2', oppId: null, title: 'Ploughshares Emerging Writer', org: 'Ploughshares', date: '2024-05-15', fee: 24, status: 'rejected', project: 'p2' },
        { id: 'l3', oppId: null, title: 'Glimmer Train Short Story Award', org: 'Glimmer Train', date: '2024-08-30', fee: 21, status: 'longlist', project: 'p1', notes: 'Made the longlist! 50 of ~3,000.' },
        { id: 'l4', oppId: null, title: 'Bread Loaf Application', org: 'Bread Loaf Writers Conference', date: '2024-12-01', fee: 15, status: 'waitlist', project: 'p1' },
        { id: 'l5', oppId: null, title: 'Pushcart Nomination', org: 'Salt Hill Journal', date: '2024-11-20', fee: 0, status: 'pending', project: 'p2' },
        { id: 'l6', oppId: null, title: 'Sewanee Writers Conference', org: 'Sewanee', date: '2025-01-15', fee: 30, status: 'rejected', project: 'p1' },
        { id: 'l7', oppId: null, title: 'Disquiet International', org: 'Disquiet', date: '2025-02-10', fee: 25, status: 'accepted', project: 'p2', notes: 'YES! Lisbon in July. Partial scholarship covered tuition.' },
        { id: 'l8', oppId: null, title: 'Tin House Summer Workshop', org: 'Tin House', date: '2025-03-01', fee: 30, status: 'rejected', project: 'p1' },
        { id: 'l9', oppId: null, title: 'Granum Foundation Prize', org: 'Granum Foundation', date: '2025-04-15', fee: 0, status: 'rejected', project: 'p1' },
        { id: 'l10', oppId: null, title: 'Brooklyn Poets Fellowship', org: 'Brooklyn Poets', date: '2025-06-01', fee: 15, status: 'shortlist', project: 'p3' },
        { id: 'l11', oppId: null, title: 'Iowa Review Award (Nonfiction)', org: 'Iowa Review', date: '2025-09-15', fee: 20, status: 'rejected', project: 'p2' },
        { id: 'l12', oppId: null, title: 'A Public Space Editorial Fellowship', org: 'A Public Space', date: '2025-11-01', fee: 0, status: 'pending', project: 'p2' },
        { id: 'l13', oppId: null, title: 'PEN/Robert J. Dau Prize', org: 'PEN America', date: '2026-01-08', fee: 0, status: 'pending', project: 'p1' },
        { id: 'l14', oppId: null, title: 'Aspen Words Emerging Writer', org: 'Aspen Words', date: '2026-02-01', fee: 25, status: 'rejected', project: 'p1' },
        { id: 'l15', oppId: null, title: 'Whiting Foundation Award', org: 'Whiting Foundation', date: '2026-03-01', fee: 0, status: 'pending', project: 'p2', notes: 'Long shot but my mentor nominated me.' },
      ],
      saved: [],         // opp ids saved to "in consideration"
      planning: [],      // opp ids on the year-planner
      drafting: [],      // opp ids being actively worked on
      notes: {},         // opp id -> note text
      kit: {
        bio_short: "Mira Okonkwo is a Nigerian-American writer from Pittsburgh. Her fiction and essays appear in Joyland, The Offing, and Salt Hill, and she's a 2025 Disquiet International fellow. She is at work on a novel.",
        bio_long: "Mira Okonkwo (she/they) is a Nigerian-American writer based in Pittsburgh. Her fiction has appeared in Joyland, The Offing, and Salt Hill Journal, and her essays in Catapult and Longreads. She holds a BA from the University of Pittsburgh and was a 2025 Disquiet International fellow in Lisbon, where she began a collection of essays on food and inheritance. She is at work on a first novel, The Salt House. Her work has received support from the Sustainable Arts Foundation and was longlisted for the Glimmer Train Short Story Award.",
        bio_micro: "Mira Okonkwo writes fiction and essays from Pittsburgh.",
        artist_statement: "I write the slow, domestic novels — the ones that move at the speed of grief and a kitchen. I'm interested in inheritance: what a body remembers, what a family preserves, what a place asks of you. I write toward the small ceremonies that keep a person whole.",
        project_statement_p1: "The Salt House is a literary novel set across three years and two coastlines — a Pittsburgh hospital ward and a crumbling salt-evaporation house on the Croatian Adriatic. When her father is diagnosed with a degenerative illness, Adaeze inherits both a sickbed and a family property no one has seen since the war. The novel braids her year of caregiving with her year of restoration, asking what we owe the people who made us, and what they owe the dirt they came from.",
        sample_excerpt_p1: "(Chapter Two, ~3,200 words — opening scene at the hospital, then the letter from Croatia. Last revised March 2026.)",
      },
      onboarded: true,
    };
  }

  // Initial state
  let STATE = loadState();
  if (!STATE.writer) STATE = seedState();
  saveState(STATE);

  function getState() { return STATE; }
  function setState(updater) {
    const next = typeof updater === 'function' ? updater(STATE) : { ...STATE, ...updater };
    STATE = next;
    saveState(STATE);
    if (global.__cpListeners) global.__cpListeners.forEach(fn => fn(STATE));
    return STATE;
  }
  global.__cpListeners = [];
  function subscribe(fn) {
    global.__cpListeners.push(fn);
    return () => { global.__cpListeners = global.__cpListeners.filter(f => f !== fn); };
  }

  // ───── Project-matching score ─────
  // No real ML — heuristic but believable. Higher is better.
  function matchScore(opp, project, writer) {
    let score = 0;
    const reasons = [];
    const desc = ((opp.description || '') + ' ' + (opp.title || '') + ' ' + (opp.eligibility_notes || '')).toLowerCase();
    const types = (opp.writing_types || '').toLowerCase();

    // Form/genre match
    const form = project.form.toLowerCase();
    if (form.includes('novel') && /novel|fiction|book[- ]length manuscript|long[- ]form/.test(desc + types)) {
      score += 28; reasons.push('novel-friendly');
    }
    if (form.includes('essay') && /essay|nonfiction|memoir/.test(desc + types)) {
      score += 28; reasons.push('essays welcome');
    }
    if (form.includes('poem') && /poet|poem|chapbook|verse/.test(desc + types)) {
      score += 28; reasons.push('poetry');
    }

    // Theme match
    project.themes.forEach(t => {
      if (desc.includes(t)) { score += 6; reasons.push('theme: ' + t); }
    });

    // Stage / emerging
    if (writer.stage === 'emerging' && /emerging|debut|first[- ]book|unpublished|early[- ]career/.test(desc + (opp.eligibility_notes||'').toLowerCase())) {
      score += 18; reasons.push('for emerging writers');
    }

    // Identity match
    (writer.identities || []).forEach(id => {
      const lc = id.toLowerCase();
      if (desc.includes(lc) || (lc === 'bipoc' && /bipoc|of color|black|indigenous|latin/.test(desc))) {
        score += 14; reasons.push(id + '-supportive');
      }
    });

    // Fee penalty for budget-constrained
    if (opp.entry_fee_numeric > 25) score -= 8;
    if (opp.entry_fee_numeric === 0) { score += 6; reasons.push('free to enter'); }

    // Award
    if ((opp.award_amount_numeric || 0) >= 5000) score += 6;
    if ((opp.award_amount_numeric || 0) >= 25000) score += 8;

    // Light random jitter so ties don't all sort the same way
    score += (opp.id ? (opp.id.charCodeAt(opp.id.length-1) % 5) : 0) * 0.5;

    return { score: Math.min(100, Math.max(0, Math.round(score))), reasons: reasons.slice(0, 3) };
  }

  function rankForProject(opps, project, writer) {
    return opps
      .map(o => ({ opp: o, ...matchScore(o, project, writer) }))
      .sort((a, b) => b.score - a.score);
  }

  global.CP = {
    TODAY,
    parseDate, dayDiff, fmtMoney, fmtDate,
    estimateEffort, effortLabel,
    loadOpps,
    getState, setState, subscribe,
    matchScore, rankForProject,
    MONTHS_SHORT, MONTHS_LONG,
  };
})(window);
