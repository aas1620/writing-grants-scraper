// Project room — describe a manuscript, see opportunities ranked for it.
// Pipeline — kanban-ish: planning → drafting → submitted → answered.

function RoomProject({ opps, state, setState, openOpp, aiOn }) {
  const [activeId, setActiveId] = useState(state.projects[0]?.id);
  const project = state.projects.find(p => p.id === activeId) || state.projects[0];
  const ranked = useMemo(() => CP.rankForProject(opps, project, state.writer), [opps, project?.id, state.writer]);

  const [aiNote, setAiNote] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const askForAdvice = async () => {
    if (!aiOn) return;
    setLoadingAi(true);
    try {
      const top = ranked.slice(0, 5).map(r => `- ${r.opp.title} (${r.opp.organization}, ${r.opp._money || 'no award'}, ${r.opp._fee})`).join('\n');
      const text = await window.claude.complete(`You are a wise mentor for a working-class emerging writer. In 3-4 short sentences, give strategic advice about which of these top matches for "${project.title}" (a ${project.form} — ${project.synopsis}) to actually pursue first. Be candid about effort and likelihood. Be warm.

Top matches:
${top}`);
      setAiNote(text.trim());
    } catch (_) {}
    setLoadingAi(false);
  };

  return (
    <div className="room-project">
      <aside className="proj-rail">
        <div className="t-mono-tiny" style={{padding: '0 8px 12px'}}>my projects</div>
        {state.projects.map(p => (
          <button key={p.id} className={"proj-tab" + (p.id === activeId ? ' on' : '')} onClick={() => setActiveId(p.id)}>
            <span className="proj-tab-dot" style={{background: `var(--${p.color})`}}></span>
            <div style={{flex: 1, minWidth: 0, textAlign: 'left'}}>
              <div className="proj-tab-title">{p.title}</div>
              <div className="t-mono-tiny" style={{marginTop: 2}}>{p.form} · {p.status}</div>
            </div>
          </button>
        ))}
        <button className="proj-tab proj-tab-new">
          <Icon d={I.plus} size={12} /> <span style={{marginLeft: 8}}>new project</span>
        </button>
      </aside>

      <div className="proj-main">
        <header className="proj-head">
          <Folio left={project.form} right={`${project.words.toLocaleString()} words · ${project.status}`} />
          <h1 className="proj-title">
            <span style={{color: `var(--${project.color})`}}>§</span> <em>{project.title}</em>
          </h1>
          <p className="proj-syn">{project.synopsis}</p>
          <div className="proj-themes">
            <span className="t-mono-tiny" style={{marginRight: 12}}>themes</span>
            {project.themes.map(t => <span key={t} className="chip">{t}</span>)}
          </div>
        </header>

        <section className="proj-section">
          <div className="proj-section-head">
            <h2 className="t-display" style={{fontSize: 32}}>What might want this work?</h2>
            <div className="t-italic" style={{color:'var(--ink-soft)', fontSize: 14, marginTop: 4}}>
              ranked by fit · drawing on form, themes, your stage, and your background
            </div>
          </div>

          {aiOn && (
            <div className="proj-ai">
              <div className="t-mono-tiny" style={{color:'var(--indigo)'}}>● a strategist's note</div>
              {!aiNote && !loadingAi && (
                <button className="btn btn-sm" style={{marginTop: 10}} onClick={askForAdvice}>ask claude where to start →</button>
              )}
              {loadingAi && <p className="t-italic" style={{marginTop: 10, color:'var(--ink-faint)'}}>thinking…</p>}
              {aiNote && <p style={{marginTop: 10, fontSize: 15, lineHeight: 1.55}}>{aiNote}</p>}
            </div>
          )}

          <div className="proj-matches">
            {ranked.slice(0, 12).map(({ opp, score, reasons }) => (
              <article key={opp.id} className="proj-match" onClick={() => openOpp(opp)}>
                <div className="proj-match-fit" style={{'--p': score}}>
                  <span>{score}</span>
                </div>
                <div className="proj-match-body">
                  <div className="proj-match-meta">
                    <span className="opp-type" style={{background: typeStyle(opp.opportunity_type).bg, color: typeStyle(opp.opportunity_type).fg}}>{opp.opportunity_type}</span>
                    {opp._isFree && <span style={{color:'var(--moss)', fontFamily:'var(--mono)', fontSize: 10, letterSpacing: '0.08em', textTransform:'uppercase'}}>free</span>}
                    <span className="t-mono-tiny">{opp._effortLabel}</span>
                  </div>
                  <h3 className="proj-match-title">{opp.title}</h3>
                  <div className="proj-match-org">{opp.organization}</div>
                  {reasons.length > 0 && (
                    <div className="proj-match-reasons">
                      {reasons.map((r, i) => <span key={i}><span style={{color: 'var(--moss)', marginRight: 4}}>✓</span>{r}</span>)}
                    </div>
                  )}
                </div>
                <div className="proj-match-right">
                  <div style={{fontFamily:'var(--serif)', fontSize: 22, fontWeight: 500}}>{opp._money || '—'}</div>
                  <div className="t-mono-tiny">{opp._date ? CP.fmtDate(opp._date, 'short') : 'rolling'}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ───── Pipeline — three columns ─────
function RoomPipeline({ opps, state, setState, openOpp }) {
  const planning = (state.planning || []).map(id => opps.find(o => o.id === id)).filter(Boolean);
  const drafting = (state.drafting || []).map(id => opps.find(o => o.id === id)).filter(Boolean);
  const submitted = (state.ledger || []).filter(l => l.status === 'pending').slice(0, 8);
  const answered = (state.ledger || []).filter(l => ['rejected','accepted','longlist','shortlist','waitlist'].includes(l.status)).slice(0, 6);

  const move = (oppId, from, to) => {
    setState(s => ({
      ...s,
      [from]: (s[from] || []).filter(x => x !== oppId),
      [to]: [...(s[to] || []), oppId],
    }));
  };

  return (
    <div className="room-pipeline">
      <header className="pipe-head">
        <Folio left="Pipeline" right="thread of submissions" />
        <h1 className="t-display" style={{fontSize: 56}}>What's <em>in flight.</em></h1>
        <p className="t-italic" style={{color:'var(--ink-soft)', fontSize: 16, marginTop: 8, maxWidth: '60ch'}}>
          From the moment you bookmark a thing to the day it answers you back. Move cards across columns to track their state.
        </p>
      </header>

      <div className="pipe-columns">
        <PipelineCol title="Planning" sub="bookmarked, waiting to draft" tone="ink-faint" count={planning.length}>
          {planning.map(o => (
            <PipelineCard key={o.id} opp={o} onClick={() => openOpp(o)}>
              <button className="pipe-move" onClick={(e) => { e.stopPropagation(); move(o.id, 'planning', 'drafting'); }}>
                begin drafting →
              </button>
            </PipelineCard>
          ))}
          {planning.length === 0 && <PipelineEmpty msg="Nothing planned yet. Browse the Reading Room." />}
        </PipelineCol>

        <PipelineCol title="Drafting" sub="in active work" tone="indigo" count={drafting.length}>
          {drafting.map(o => (
            <PipelineCard key={o.id} opp={o} onClick={() => openOpp(o)}>
              <div className="pipe-checklist">
                <label><input type="checkbox" defaultChecked /> bio</label>
                <label><input type="checkbox" defaultChecked /> writing sample</label>
                <label><input type="checkbox" /> project statement</label>
                <label><input type="checkbox" /> double-check guidelines</label>
              </div>
              <button className="pipe-move" onClick={(e) => { e.stopPropagation(); move(o.id, 'drafting', 'planning'); }}>← back to planning</button>
            </PipelineCard>
          ))}
          {drafting.length === 0 && <PipelineEmpty msg="Nothing drafting. Pull from planning." />}
        </PipelineCol>

        <PipelineCol title="Submitted" sub="awaiting reply" tone="ochre-deep" count={submitted.length}>
          {submitted.map(l => (
            <article key={l.id} className="pipe-card pipe-card-ledger">
              <div className="pipe-meta-top">
                <span className="stamp stamp-pending">pending</span>
                <span className="t-mono-tiny">{new Date(l.date).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</span>
              </div>
              <h4 className="pipe-card-title">{l.title}</h4>
              <div className="pipe-card-org">{l.org}</div>
              {l.fee > 0 && <div className="t-mono-tiny" style={{marginTop: 8}}>fee paid · ${l.fee}</div>}
            </article>
          ))}
        </PipelineCol>

        <PipelineCol title="Answered" sub="recent decisions" tone="oxblood" count={answered.length}>
          {answered.map(l => (
            <article key={l.id} className="pipe-card pipe-card-ledger">
              <div className="pipe-meta-top">
                <span className={`stamp stamp-${l.status === 'accepted' ? 'accepted' : l.status === 'longlist' || l.status === 'shortlist' ? 'shortlist' : 'rejected'} ${l.status === 'rejected' ? 'rotated' : ''}`}>{l.status}</span>
                <span className="t-mono-tiny">{new Date(l.date).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</span>
              </div>
              <h4 className="pipe-card-title">{l.title}</h4>
              <div className="pipe-card-org">{l.org}</div>
              {l.notes && <p className="t-italic" style={{fontSize: 13, marginTop: 8, color:'var(--ink-soft)'}}>"{l.notes}"</p>}
            </article>
          ))}
        </PipelineCol>
      </div>
    </div>
  );
}

function PipelineCol({ title, sub, tone, count, children }) {
  return (
    <section className="pipe-col">
      <header className="pipe-col-head">
        <div>
          <h3 className="pipe-col-title" style={{color: `var(--${tone})`}}>{title}</h3>
          <div className="t-italic" style={{fontSize: 13, color:'var(--ink-faint)'}}>{sub}</div>
        </div>
        <div className="pipe-col-count">{count}</div>
      </header>
      <div className="pipe-col-body">{children}</div>
    </section>
  );
}

function PipelineCard({ opp, onClick, children }) {
  return (
    <article className="pipe-card" onClick={onClick}>
      <div className="pipe-meta-top">
        <span className="opp-type" style={{background: typeStyle(opp.opportunity_type).bg, color: typeStyle(opp.opportunity_type).fg}}>{opp.opportunity_type}</span>
        <span className="t-mono-tiny">{opp._date ? CP.fmtDate(opp._date, 'short') : 'rolling'}</span>
      </div>
      <h4 className="pipe-card-title">{opp.title}</h4>
      <div className="pipe-card-org">{opp.organization}</div>
      <div className="pipe-card-foot">
        {opp.award_amount_numeric > 0 && <span><b>{opp._money}</b></span>}
        <span style={{color:'var(--ink-faint)'}}>{opp._isFree ? 'free entry' : `fee ${opp._fee}`}</span>
        <span className="t-italic" style={{color:'var(--ink-faint)'}}>{opp._effortLabel}</span>
      </div>
      {children}
    </article>
  );
}

function PipelineEmpty({ msg }) {
  return <div className="pipe-empty"><em>{msg}</em></div>;
}

window.RoomProject = RoomProject;
window.RoomPipeline = RoomPipeline;
