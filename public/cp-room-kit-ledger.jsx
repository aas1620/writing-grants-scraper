// Application Kit — bios, statements, samples; reusable building blocks.
// Ledger — every submission ever, with stamps and a "rejection wall".

function RoomKit({ state, setState, aiOn }) {
  const k = state.kit;
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const begin = (key) => {
    setEditing(key);
    setDraft(k[key] || '');
    setAiSuggestion(null);
  };

  const save = () => {
    setState(s => ({ ...s, kit: { ...s.kit, [editing]: draft } }));
    setEditing(null);
  };

  const askClaude = async () => {
    if (!aiOn || !editing) return;
    setLoadingAi(true);
    try {
      const labels = {
        bio_short: 'a 50-word author bio (third person)',
        bio_long: 'a 120-word author bio (third person)',
        bio_micro: 'a 12-word micro-bio',
        artist_statement: 'a one-paragraph artist statement (first person, ~80 words)',
      };
      const prompt = `Polish this ${labels[editing] || 'text'} for a working-class emerging writer. Keep their voice. Be tight, honest, no purple prose. Return only the polished version.

CURRENT:
${draft}`;
      const text = await window.claude.complete(prompt);
      setAiSuggestion(text.trim());
    } catch (_) {}
    setLoadingAi(false);
  };

  const items = [
    { key: 'bio_micro', label: 'Micro-bio', sub: '12 words. For thumbnail rejections.', meta: '12 wd' },
    { key: 'bio_short', label: 'Short bio', sub: 'About 50 words. The standard ask.', meta: '50 wd' },
    { key: 'bio_long', label: 'Long bio', sub: 'About 120 words. For grants & residencies.', meta: '120 wd' },
    { key: 'artist_statement', label: 'Artist statement', sub: 'A paragraph about how you write and why.', meta: '~80 wd' },
    { key: 'project_statement_p1', label: `Project statement — The Salt House`, sub: 'For the novel-in-progress.', meta: '~120 wd' },
  ];

  return (
    <div className="room-kit">
      <header className="kit-head">
        <Folio left="Application Kit" right="reusable bits" />
        <h1 className="t-display" style={{fontSize: 56}}>Your <em>kit.</em></h1>
        <p className="t-italic" style={{color:'var(--ink-soft)', fontSize: 16, marginTop: 8, maxWidth: '60ch'}}>
          The pieces you write once and copy a hundred times. Drafted clearly, kept up to date, ready to paste into any form
          at three in the morning the night before a deadline.
        </p>
      </header>

      <div className="kit-grid">
        {items.map(item => (
          <article key={item.key} className="kit-card" onClick={() => begin(item.key)}>
            <header className="kit-card-head">
              <h3 className="kit-card-title">{item.label}</h3>
              <span className="t-mono-tiny">{item.meta}</span>
            </header>
            <div className="t-italic" style={{color:'var(--ink-faint)', fontSize: 13, marginBottom: 16}}>{item.sub}</div>
            <div className="kit-card-body">
              {(k[item.key] || '').slice(0, 280)}{(k[item.key] || '').length > 280 ? '…' : ''}
            </div>
            <footer className="kit-card-foot">
              <span className="t-mono-tiny">last updated · mar 2026</span>
              <span className="t-mono-tiny">edit →</span>
            </footer>
          </article>
        ))}

        <article className="kit-card kit-card-sample">
          <header className="kit-card-head">
            <h3 className="kit-card-title">Writing samples</h3>
            <span className="t-mono-tiny">3 ready</span>
          </header>
          <div className="t-italic" style={{color:'var(--ink-faint)', fontSize: 13, marginBottom: 16}}>
            Excerpts you've prepared and labeled by length & form.
          </div>
          <ul className="kit-samples">
            <li><span className="t-mono-tiny">3,200 wd · fiction</span><span>The Salt House — Chapter Two</span></li>
            <li><span className="t-mono-tiny">2,400 wd · cnf</span><span>How to Salt Tomatoes — opening essay</span></li>
            <li><span className="t-mono-tiny">12 pp · poetry</span><span>Field Notes from a Fever — selections</span></li>
          </ul>
        </article>
      </div>

      {editing && (
        <div className="kit-modal-bg" onClick={() => setEditing(null)}>
          <div className="kit-modal" onClick={e => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setEditing(null)}><Icon d={I.x} /></button>
            <div className="t-mono-tiny">editing</div>
            <h2 className="t-display" style={{fontSize: 32, marginTop: 4}}>{items.find(x => x.key === editing)?.label}</h2>
            <textarea className="kit-edit" rows="12" value={draft} onChange={e => setDraft(e.target.value)} />
            <div className="t-mono-tiny" style={{textAlign:'right'}}>{draft.split(/\s+/).filter(Boolean).length} words</div>
            {aiOn && (
              <div className="kit-ai">
                <div className="t-mono-tiny" style={{color:'var(--indigo)', marginBottom: 8}}>● claude can polish this</div>
                {!aiSuggestion && !loadingAi && <button className="btn btn-sm" onClick={askClaude}>ask claude to tighten →</button>}
                {loadingAi && <em style={{color:'var(--ink-faint)'}}>thinking…</em>}
                {aiSuggestion && (
                  <div>
                    <p style={{fontSize: 14, lineHeight: 1.6, marginTop: 6}}>{aiSuggestion}</p>
                    <div style={{display:'flex', gap: 8, marginTop: 10}}>
                      <button className="btn btn-sm" onClick={() => setDraft(aiSuggestion)}>use this →</button>
                      <button className="btn btn-sm" onClick={() => setAiSuggestion(null)}>discard</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div style={{display:'flex', gap: 8, marginTop: 16, justifyContent:'flex-end'}}>
              <button className="btn" onClick={() => setEditing(null)}>cancel</button>
              <button className="btn btn-filled" onClick={save}>save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───── Ledger ─────
function RoomLedger({ state, aiOn }) {
  const ledger = state.ledger || [];
  const [view, setView] = useState('table'); // table | wall | reflection

  // Stats
  const total = ledger.length;
  const accepted = ledger.filter(l => l.status === 'accepted').length;
  const rejected = ledger.filter(l => l.status === 'rejected').length;
  const recognized = ledger.filter(l => ['longlist', 'shortlist', 'waitlist'].includes(l.status)).length;
  const totalFees = ledger.reduce((s, l) => s + (l.fee || 0), 0);
  const accRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

  // Group by year
  const byYear = useMemo(() => {
    const g = {};
    ledger.forEach(l => {
      const y = new Date(l.date).getFullYear();
      g[y] = g[y] || [];
      g[y].push(l);
    });
    return g;
  }, [ledger]);

  // AI reflection
  const [reflection, setReflection] = useState(null);
  const [loadingReflection, setLoadingReflection] = useState(false);
  const askForReflection = async () => {
    if (!aiOn) return;
    setLoadingReflection(true);
    try {
      const summary = ledger.map(l => `${l.date}: ${l.title} (${l.org}) — ${l.status}`).join('\n');
      const text = await window.claude.complete(`You are a wise, warm mentor for a working-class emerging writer (Mira). Read this submission history and write a 4-5 sentence reflection in second person ("you"). Notice patterns, name the labor honestly, locate small wins, and end with one practical thing to try next. Avoid platitudes. Avoid the word "journey".

History:
${summary}`);
      setReflection(text.trim());
    } catch (_) {}
    setLoadingReflection(false);
  };

  return (
    <div className="room-ledger">
      <header className="ledger-head">
        <Folio left="The Ledger" right={`${total} submissions, all-time`} />
        <h1 className="t-display" style={{fontSize: 56}}>Every <em>yes</em> & <em>no.</em></h1>
        <p className="t-italic" style={{color:'var(--ink-soft)', fontSize: 16, marginTop: 8, maxWidth: '60ch'}}>
          A record of the labor. Not a leaderboard — a memory. Use it to recycle past materials, learn what tends to land,
          and to remember, on hard days, what you've already done.
        </p>

        <div className="ledger-stats">
          <div className="ledger-stat"><div className="t-display" style={{fontSize: 40}}>{total}</div><div className="t-mono-tiny">submissions</div></div>
          <div className="ledger-stat"><div className="t-display" style={{fontSize: 40, color:'var(--moss)'}}>{accepted}</div><div className="t-mono-tiny">accepted</div></div>
          <div className="ledger-stat"><div className="t-display" style={{fontSize: 40, color:'var(--ochre-deep)'}}>{recognized}</div><div className="t-mono-tiny">recognized</div></div>
          <div className="ledger-stat"><div className="t-display" style={{fontSize: 40, color:'var(--oxblood)'}}>{rejected}</div><div className="t-mono-tiny">declined</div></div>
          <div className="ledger-stat"><div className="t-display" style={{fontSize: 40}}>${totalFees}</div><div className="t-mono-tiny">in fees, ever</div></div>
        </div>

        <div className="ledger-tabs">
          <button className={"ledger-tab" + (view === 'table' ? ' on' : '')} onClick={() => setView('table')}>The book</button>
          <button className={"ledger-tab" + (view === 'wall' ? ' on' : '')} onClick={() => setView('wall')}>The wall</button>
          <button className={"ledger-tab" + (view === 'reflection' ? ' on' : '')} onClick={() => setView('reflection')}>A reflection</button>
        </div>
      </header>

      {view === 'table' && (
        <div className="ledger-book ledger-paper">
          {Object.keys(byYear).sort((a, b) => b - a).map(year => (
            <div key={year} className="ledger-year">
              <h2 className="ledger-year-title">{year}</h2>
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th style={{width: 90}}>date</th>
                    <th>title / organization</th>
                    <th style={{width: 110}}>project</th>
                    <th style={{width: 60}}>fee</th>
                    <th style={{width: 110}}>result</th>
                    <th style={{width: 200}}>note</th>
                  </tr>
                </thead>
                <tbody>
                  {byYear[year].sort((a, b) => new Date(b.date) - new Date(a.date)).map(l => {
                    const proj = state.projects.find(p => p.id === l.project);
                    return (
                      <tr key={l.id} className={`ledger-tr ledger-tr-${l.status}`}>
                        <td className="t-mono-tiny">{new Date(l.date).toLocaleDateString('en-US', {month:'short', day:'numeric'}).toLowerCase()}</td>
                        <td>
                          <div style={{fontFamily:'var(--serif)', fontSize: 15, fontStyle: l.status === 'accepted' ? 'italic' : 'normal'}}>{l.title}</div>
                          <div className="t-mono-tiny" style={{marginTop: 2}}>{l.org}</div>
                        </td>
                        <td className="t-italic" style={{fontSize: 13, color: proj ? `var(--${proj.color})` : 'var(--ink-faint)'}}>{proj?.title || '—'}</td>
                        <td className="t-mono-tiny">{l.fee ? '$' + l.fee : 'free'}</td>
                        <td>
                          <span className={`stamp stamp-${l.status === 'accepted' ? 'accepted' : l.status === 'longlist' || l.status === 'shortlist' || l.status === 'waitlist' ? 'shortlist' : l.status === 'pending' ? 'pending' : 'rejected'}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="t-italic" style={{fontSize: 13, color:'var(--ink-soft)'}}>{l.notes || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {view === 'wall' && (
        <div className="ledger-wall">
          <p className="t-italic" style={{textAlign:'center', color:'var(--ink-faint)', fontSize: 14, marginBottom: 28}}>
            "A writer is one who has taught their mind to misbehave." — Oscar Wilde, probably. Anyway —
            here are the ones that said no.
          </p>
          <div className="wall-grid">
            {ledger.filter(l => l.status === 'rejected').map((l, i) => (
              <div key={l.id} className="wall-card" style={{transform: `rotate(${(i % 5) - 2}deg)`}}>
                <span className="tape" style={{left: 20 + (i % 3) * 20 + 'px'}}></span>
                <div className="t-mono-tiny" style={{textAlign:'right', color:'var(--ink-faint)'}}>{new Date(l.date).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}).toLowerCase()}</div>
                <h4 style={{fontFamily:'var(--serif)', fontSize: 17, marginTop: 8, lineHeight: 1.25}}>{l.title}</h4>
                <div className="t-mono-tiny" style={{marginTop: 4, color:'var(--ink-faint)'}}>{l.org}</div>
                <div style={{marginTop: 14, display: 'flex', justifyContent: 'center'}}>
                  <span className="stamp stamp-rejected rotated" style={{transform: `rotate(${-2 + (i % 4)}deg)`}}>declined</span>
                </div>
                {l.notes && <p className="t-italic" style={{marginTop: 10, fontSize: 12, color:'var(--ink-soft)'}}>{l.notes}</p>}
              </div>
            ))}
          </div>
          <p className="t-italic" style={{textAlign:'center', color:'var(--ink-faint)', fontSize: 13, marginTop: 32, lineHeight: 1.6}}>
            <span className="t-hand" style={{display:'block', fontSize: 22, color:'var(--indigo)', marginBottom: 6}}>this is what showing up looks like.</span>
            every name on this wall was a thing you finished. that's the part you can control.
          </p>
        </div>
      )}

      {view === 'reflection' && (
        <div className="ledger-reflection">
          {!aiOn ? (
            <div className="reflection-empty">
              <p className="t-italic" style={{fontSize: 18, color:'var(--ink-soft)', maxWidth: '50ch', margin: '0 auto', textAlign:'center'}}>
                Reflections are penned by Claude. Toggle the AI mode in the corner to receive one based on your history.
              </p>
            </div>
          ) : (
            <div className="reflection-card">
              <div className="t-mono-tiny" style={{color:'var(--indigo)'}}>● from claude, having read your ledger</div>
              {!reflection && !loadingReflection && (
                <div style={{marginTop: 16}}>
                  <p className="t-italic" style={{color:'var(--ink-soft)', fontSize: 15, lineHeight: 1.6}}>
                    Want a candid look at what your record says? Patterns, small wins, what to try next.
                  </p>
                  <button className="btn btn-filled" style={{marginTop: 16}} onClick={askForReflection}>read my history →</button>
                </div>
              )}
              {loadingReflection && <p className="t-italic" style={{marginTop: 16, color:'var(--ink-faint)'}}>reading…</p>}
              {reflection && (
                <div style={{marginTop: 18, fontFamily:'var(--serif)', fontSize: 18, lineHeight: 1.65, maxWidth: '52ch'}}>
                  {reflection.split('\n').map((p, i) => p && <p key={i} style={{marginBottom: 12}}>{p}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

window.RoomKit = RoomKit;
window.RoomLedger = RoomLedger;
