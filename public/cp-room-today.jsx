// Rooms: Today, Pipeline, Year, Reading, Project, Kit, Ledger
// Each is a function returning a fragment.

const ROOMS = [
  { id: 'today',    label: 'Today',         icon: I.sun,     hint: 'morning page' },
  { id: 'project',  label: 'My Projects',   icon: I.book,    hint: 'matched to your work' },
  { id: 'reading',  label: 'Reading Room',  icon: I.feather, hint: 'browse like a magazine' },
  { id: 'year',     label: 'The Year',      icon: I.cal,     hint: 'plan twelve months' },
  { id: 'pipeline', label: 'Pipeline',      icon: I.thread,  hint: 'in flight' },
  { id: 'kit',      label: 'Application Kit', icon: I.drawer, hint: 'reusable bits' },
  { id: 'ledger',   label: 'The Ledger',    icon: I.ledger,  hint: 'every yes & no' },
];

// ───── Today ─────
function RoomToday({ opps, state, setState, openOpp, aiOn }) {
  const writer = state.writer;
  const today = CP.TODAY;
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Closing soon (≤14 days)
  const urgent = opps.filter(o => o._days != null && o._days >= 0 && o._days <= 14)
    .sort((a, b) => a._days - b._days)
    .slice(0, 5);

  // Best fit for primary project
  const project = state.projects[0];
  const ranked = useMemo(() => CP.rankForProject(opps, project, writer).slice(0, 4), [opps, project?.id]);

  // In flight
  const planning = state.planning || [];
  const drafting = state.drafting || [];
  const inFlight = opps.filter(o => planning.includes(o.id) || drafting.includes(o.id));

  // Budget meter
  const yearBudget = writer.budget_year || 200;
  const yearSpent = (state.ledger || []).filter(l => {
    const d = new Date(l.date);
    return d.getFullYear() === today.getFullYear();
  }).reduce((s, l) => s + (l.fee || 0), 0);

  // Recent ledger items (last 3)
  const recent = [...(state.ledger || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);

  // Daily prompt — a literary epigraph
  const epigraphs = [
    { q: "The only end of writing is to enable the readers better to enjoy life, or better to endure it.", a: 'Samuel Johnson' },
    { q: "We work in the dark — we do what we can — we give what we have. Our doubt is our passion, and our passion is our task.", a: 'Henry James' },
    { q: "I write entirely to find out what I'm thinking, what I'm looking at, what I see and what it means.", a: 'Joan Didion' },
    { q: "If a story is not about the hearer he will not listen.", a: 'John Steinbeck' },
    { q: "Style is the perfection of a point of view.", a: 'Richard Eberhart' },
  ];
  const epi = epigraphs[today.getDate() % epigraphs.length];

  return (
    <div className="room-today">
      <header className="today-head">
        <Folio left={`Folio ${today.getDate().toString().padStart(2,'0')}`} right={dateStr.toLowerCase()} />
        <h1 className="today-greeting"><span className="t-italic">{greeting},</span> {writer.name.split(' ')[0]}.</h1>
        <p className="today-blurb">
          You have <b>{drafting.length}</b> {drafting.length === 1 ? 'application' : 'applications'} drafting,
          {' '}<b>{planning.length}</b> on the planner, and{' '}
          <b>{urgent.length}</b> {urgent.length === 1 ? 'thing' : 'things'} closing in the next two weeks.
        </p>
      </header>

      <div className="today-grid">
        <section className="today-card today-epigraph">
          <div className="t-mono-tiny">a thought for the day</div>
          <blockquote>
            <p className="t-italic" style={{fontSize: 22, lineHeight: 1.35, marginTop: 12}}>"{epi.q}"</p>
            <footer style={{marginTop: 14, fontSize: 14, color: 'var(--ink-soft)'}}>— {epi.a}</footer>
          </blockquote>
        </section>

        <section className="today-card today-budget">
          <div className="t-mono-tiny">submission budget · {today.getFullYear()}</div>
          <div className="budget-row">
            <div className="budget-num"><span className="t-display" style={{fontSize: 38}}>${yearSpent}</span><span style={{color:'var(--ink-faint)'}}> / ${yearBudget}</span></div>
            <div className="budget-bar"><div className="budget-fill" style={{width: Math.min(100, (yearSpent/yearBudget)*100)+'%'}}></div></div>
          </div>
          <p className="t-italic" style={{fontSize: 13, color: 'var(--ink-soft)', marginTop: 6}}>
            ${yearBudget - yearSpent} left for fees this year. {urgent.filter(o => o._isFree).length} free things close soon.
          </p>
        </section>

        <section className="today-card today-urgent">
          <div className="today-card-head">
            <div className="t-mono-tiny" style={{color:'var(--oxblood)'}}>● closing soon</div>
            <span className="t-mono-tiny" style={{color:'var(--ink-faint)'}}>next 14 days</span>
          </div>
          {urgent.length === 0 && <p style={{marginTop: 12, color: 'var(--ink-faint)', fontStyle:'italic'}}>nothing pressing. exhale.</p>}
          {urgent.map(o => (
            <button key={o.id} className="today-row" onClick={() => openOpp(o)}>
              <div className="today-row-date">
                <div className="t-mono" style={{fontSize:10}}>{CP.MONTHS_SHORT[o._date.getMonth()].toLowerCase()}</div>
                <div style={{fontFamily:'var(--serif)', fontSize: 26, fontWeight:500, lineHeight: 1, color: o._days <= 7 ? 'var(--oxblood)' : 'var(--ink)'}}>{o._date.getDate()}</div>
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <div className="today-row-title">{o.title}</div>
                <div className="today-row-meta">{o.organization} · {o._isFree ? <em style={{color:'var(--moss)'}}>free</em> : o._fee} · {o._effortLabel}</div>
              </div>
              <div className="today-row-arrow"><Icon d={I.arrow} size={12} /></div>
            </button>
          ))}
        </section>

        <section className="today-card today-recommend">
          <div className="today-card-head">
            <div className="t-mono-tiny">for <em>{project.title}</em></div>
            <span className="t-mono-tiny" style={{color:'var(--ink-faint)'}}>by fit</span>
          </div>
          <p className="t-italic" style={{fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12}}>
            things that might want a {project.form} like yours.
          </p>
          {ranked.map(({ opp, score, reasons }) => (
            <button key={opp.id} className="today-rec" onClick={() => openOpp(opp)}>
              <div className="today-rec-fit" style={{'--p': score}}><span>{score}</span></div>
              <div style={{flex: 1, minWidth: 0}}>
                <div className="today-rec-title">{opp.title}</div>
                <div className="today-rec-meta">
                  {opp._money && <span>{opp._money}</span>}
                  {opp._money && <span style={{color:'var(--rule)'}}> · </span>}
                  {opp._date ? <span>{CP.fmtDate(opp._date, 'short')}</span> : <em>rolling</em>}
                  {reasons[0] && <span style={{color:'var(--ink-faint)'}}> · {reasons[0]}</span>}
                </div>
              </div>
            </button>
          ))}
        </section>

        <section className="today-card today-pipe">
          <div className="today-card-head">
            <div className="t-mono-tiny">in flight</div>
            <span className="t-mono-tiny" style={{color:'var(--ink-faint)'}}>{inFlight.length} active</span>
          </div>
          {inFlight.length === 0 && <p style={{marginTop: 12, color: 'var(--ink-faint)', fontStyle:'italic'}}>nothing in flight. pick something.</p>}
          {inFlight.slice(0, 4).map(o => (
            <button key={o.id} className="today-pipe-row" onClick={() => openOpp(o)}>
              <span className={"pipe-dot " + (drafting.includes(o.id) ? 'drafting' : 'planning')}></span>
              <div style={{flex: 1, minWidth: 0}}>
                <div className="today-row-title">{o.title}</div>
                <div className="today-row-meta">
                  {drafting.includes(o.id) ? 'drafting' : 'planning'} · {o._date ? `due ${CP.fmtDate(o._date, 'short')}` : 'rolling'}
                </div>
              </div>
            </button>
          ))}
        </section>

        <section className="today-card today-recent">
          <div className="today-card-head">
            <div className="t-mono-tiny">recent ledger</div>
            <span className="t-mono-tiny" style={{color:'var(--ink-faint)'}}>last entries</span>
          </div>
          {recent.map(l => (
            <div key={l.id} className="ledger-row-mini">
              <span className={"ledger-status ledger-" + l.status}>{l.status === 'rejected' ? '×' : l.status === 'accepted' ? '✓' : l.status === 'longlist' || l.status === 'shortlist' ? '○' : '·'}</span>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: 14}}>{l.title}</div>
                <div className="t-mono-tiny" style={{marginTop: 2}}>{l.status} · {new Date(l.date).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}</div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

window.RoomToday = RoomToday;
window.ROOMS = ROOMS;
