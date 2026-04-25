// The Commonplace — main app
// Six "rooms": Today, Pipeline, Year (calendar/garden), Reading Room, Project, Kit, Ledger

const { useState, useEffect, useMemo, useRef, useCallback, Fragment } = React;

// ───── Tiny SVG icons (stroke style, 1.4 width) ─────
const Icon = ({ d, size = 14, fill = "none", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    {Array.isArray(d) ? d.map((x, i) => <path key={i} d={x} />) : <path d={d} />}
  </svg>
);
const I = {
  pen: "M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586 M11 11a2 2 0 1 0 4 0 2 2 0 1 0-4 0",
  book: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  cal: "M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  envelope: "M4 4h16v16H4z M4 4l8 8 8-8",
  star: "M12 2l3 7 7 .5-5.5 4.5L18 21l-6-3.5L6 21l1.5-7L2 9.5 9 9z",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  plus: "M12 5v14 M5 12h14",
  x: "M18 6L6 18 M6 6l12 12",
  check: "M5 12l5 5L20 7",
  ledger: "M3 6h18 M3 12h18 M3 18h18",
  flame: "M12 22c4-1 7-4 7-9 0-3-1-5-3-7 0 2-1 3-3 3 0-3-2-6-5-7-1 5-4 6-4 11 0 5 3 8 8 9z",
  feather: "M21 4c-3 0-9 1-13 7-2 3-3 6-3 9 3 0 6-1 9-3 6-4 7-10 7-13z M3 21l9-9 M14 8l-1 1",
  sun: "M12 4V2 M12 22v-2 M4 12H2 M22 12h-2 M6.3 6.3L4.9 4.9 M19.1 19.1l-1.4-1.4 M6.3 17.7l-1.4 1.4 M19.1 4.9l-1.4 1.4",
  thread: "M4 4l16 16 M4 12h16 M12 4v16",
  archive: "M3 3h18v4H3z M5 7v14h14V7 M10 12h4",
  drawer: "M3 3h18v6H3z M3 9h18v6H3z M3 15h18v6H3z M9 6h6 M9 12h6 M9 18h6",
  inkwell: "M6 14a6 6 0 0 0 12 0 V8H6z M9 4l3-2 3 2 M12 2v4",
  dot: "M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0",
};

// ───── Type tag colors ─────
const TYPE_COLORS = {
  contest:   { bg: 'var(--ochre-soft)', fg: 'var(--ochre-deep)' },
  grant:     { bg: 'var(--moss-soft)',  fg: 'var(--moss)' },
  fellowship:{ bg: 'var(--indigo-soft)',fg: 'var(--indigo)' },
  residency: { bg: 'var(--oxblood-soft)', fg: 'var(--oxblood)' },
  unknown:   { bg: 'var(--paper-deep)', fg: 'var(--ink-soft)' },
};
const typeStyle = (t) => TYPE_COLORS[t] || TYPE_COLORS.unknown;

// ───── Reusable: opportunity card ─────
function OppCard({ opp, project, score, reasons, onOpen, onSave, isSaved, isPlanning, density = 'normal' }) {
  const days = opp._days;
  const urgent = days != null && days >= 0 && days <= 14;
  const thisMonth = days != null && days >= 0 && days <= 30;
  const t = opp.opportunity_type || 'unknown';
  const ts = typeStyle(t);

  return (
    <article className="opp-card" data-urgent={urgent} onClick={() => onOpen?.(opp)}>
      <div className="opp-date">
        {opp._date ? (
          <Fragment>
            <div className="opp-month">{CP.MONTHS_SHORT[opp._date.getMonth()].toLowerCase()}</div>
            <div className="opp-day" style={urgent ? { color: 'var(--oxblood)' } : null}>{opp._date.getDate()}</div>
            <div className="opp-year">'{String(opp._date.getFullYear()).slice(2)}</div>
          </Fragment>
        ) : (
          <div style={{ fontStyle: 'italic', color: 'var(--ink-faint)', fontSize: 14, paddingTop: 4 }}>rolling</div>
        )}
      </div>

      <div className="opp-body">
        <div className="opp-meta-top">
          <span className="opp-type" style={{ background: ts.bg, color: ts.fg }}>{t}</span>
          {opp._isFree && <span className="opp-free">free to enter</span>}
          {!opp._isFree && opp.entry_fee_numeric != null && <span className="opp-fee">entry: {opp._fee}</span>}
          <span className="opp-effort">· {opp._effortLabel}</span>
          {urgent && <span className="opp-urgent">closes in {days}d</span>}
        </div>
        <h3 className="opp-title">{opp.title}</h3>
        {opp.organization && <div className="opp-org">{opp.organization}</div>}
        {density !== 'tight' && opp.description && (
          <p className="opp-desc">{opp.description.slice(0, 160)}{opp.description.length > 160 ? '…' : ''}</p>
        )}
        {reasons && reasons.length > 0 && (
          <div className="opp-reasons">
            {reasons.map((r, i) => <span key={i} className="opp-reason">· {r}</span>)}
          </div>
        )}
      </div>

      <div className="opp-right">
        {opp.award_amount_numeric > 0 && (
          <div className="opp-award">
            <div className="opp-award-num">{opp._money}</div>
            <div className="opp-award-lbl">award</div>
          </div>
        )}
        {score != null && score > 0 && (
          <div className="opp-score" title={`${score}% fit`}>
            <div className="opp-score-ring" style={{ '--p': score }}>
              <span>{score}</span>
            </div>
            <div className="opp-score-lbl">fit</div>
          </div>
        )}
        <div className="opp-actions">
          <button className={"opp-save" + (isSaved ? ' on' : '')} onClick={e => { e.stopPropagation(); onSave?.(opp); }} title={isSaved ? 'Saved' : 'Save'}>
            <Icon d={I.bookmark} size={13} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </article>
  );
}

// ───── Page chrome ─────
function Folio({ left, right }) {
  return (
    <div className="folio-row">
      <div className="folio">{left}</div>
      <div className="folio">{right}</div>
    </div>
  );
}

// ───── Drawer (detail view) ─────
function Drawer({ opp, project, onClose, onSave, isSaved, onPlan, isPlanned, aiOn }) {
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!opp || !aiOn) { setAiSummary(null); return; }
    setAiLoading(true);
    setAiSummary(null);
    let cancelled = false;
    (async () => {
      try {
        const prompt = `You are a wise mentor for an emerging writer. In TWO sentences (max 40 words total), give a candid take on whether this opportunity is worth applying to and why. Be honest and practical, not promotional.

Title: ${opp.title}
Organization: ${opp.organization || ''}
Type: ${opp.opportunity_type}
Award: ${opp.award_amount || ''}
Fee: ${opp.entry_fee || ''}
Description: ${opp.description || ''}

Writer's project: A ${project?.form || 'novel'} called "${project?.title}" — ${project?.synopsis || ''}`;
        const text = await window.claude.complete(prompt);
        if (!cancelled) setAiSummary(text.trim());
      } catch (e) {
        if (!cancelled) setAiSummary(null);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [opp?.id, aiOn, project?.id]);

  if (!opp) return null;
  const ts = typeStyle(opp.opportunity_type);

  return (
    <Fragment>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer">
        <button className="drawer-close" onClick={onClose}><Icon d={I.x} /></button>

        <div className="drawer-eyebrow">
          <span className="opp-type" style={{ background: ts.bg, color: ts.fg }}>{opp.opportunity_type || 'opportunity'}</span>
          <span className="t-mono-tiny">via {{pw:'Poets & Writers', reedsy:'Reedsy', aca:'Artist Communities', ffw:'FundsForWriters'}[opp.source] || opp.source}</span>
        </div>
        <h1 className="drawer-title">{opp.title}</h1>
        {opp.organization && <div className="drawer-org">offered by <em>{opp.organization}</em></div>}

        <div className="drawer-stats">
          <div><div className="t-mono-tiny">award</div><div className="ds-num">{opp._money || opp.award_amount || '—'}</div></div>
          <div><div className="t-mono-tiny">entry fee</div><div className="ds-num" style={opp._isFree ? {color: 'var(--moss)'} : null}>{opp._fee || opp.entry_fee || '—'}</div></div>
          <div><div className="t-mono-tiny">deadline</div><div className="ds-num">{opp._date ? CP.fmtDate(opp._date, 'med') : 'rolling'}</div>{opp._days != null && opp._days >= 0 && <div className="t-mono-tiny" style={opp._days <= 14 ? {color:'var(--oxblood)'}:null}>in {opp._days} days</div>}</div>
          <div><div className="t-mono-tiny">effort</div><div className="ds-num" style={{fontStyle:'italic'}}>{opp._effortLabel}</div></div>
        </div>

        {aiOn && (
          <div className="drawer-ai">
            <div className="t-mono-tiny" style={{color:'var(--indigo)'}}>● a candid take from claude</div>
            <div className="drawer-ai-body">
              {aiLoading && <em style={{color:'var(--ink-ghost)'}}>thinking…</em>}
              {!aiLoading && aiSummary && <p>{aiSummary}</p>}
              {!aiLoading && !aiSummary && <em style={{color:'var(--ink-ghost)'}}>no take available offline.</em>}
            </div>
          </div>
        )}

        {opp.description && (
          <Fragment>
            <div className="drawer-section-label">about</div>
            <p className="drawer-desc">{opp.description}</p>
          </Fragment>
        )}

        {opp._genres.length > 0 && (
          <Fragment>
            <div className="drawer-section-label">genres</div>
            <div className="drawer-tags">{opp._genres.map(g => <span key={g} className="chip">{g}</span>)}</div>
          </Fragment>
        )}

        {opp.eligibility_notes && (
          <Fragment>
            <div className="drawer-section-label">eligibility</div>
            <p style={{fontSize: 14, color: 'var(--ink-soft)', marginTop: 4}}>{opp.eligibility_notes}</p>
          </Fragment>
        )}

        <div className="drawer-foot">
          {opp.url && <a href={opp.url} target="_blank" rel="noopener" className="btn btn-filled" style={{flex:1, justifyContent:'center'}}><Icon d={I.arrow} size={12} /> open application</a>}
          <button className="btn" onClick={() => onSave?.(opp)}>{isSaved ? 'saved ✓' : 'save'}</button>
          <button className="btn" onClick={() => onPlan?.(opp)}>{isPlanned ? 'on planner ✓' : 'plan it'}</button>
        </div>
      </aside>
    </Fragment>
  );
}

// Export
Object.assign(window, { Icon, I, OppCard, Folio, Drawer, typeStyle });
