// Reading Room — browse like a literary magazine, not a database.
// Two-column "broadside" with a featured spread, then editorial spreads grouped by month.

function RoomReading({ opps, state, openOpp, aiOn }) {
  const [filter, setFilter] = useState('all'); // all | free | this-month | poetry | fiction | nonfiction
  const [sort, setSort] = useState('curated'); // curated | deadline | effort | award

  const filtered = useMemo(() => {
    let f = opps;
    if (filter === 'free') f = f.filter(o => o._isFree);
    if (filter === 'this-month') f = f.filter(o => o._days != null && o._days >= 0 && o._days <= 30);
    if (filter === 'poetry') f = f.filter(o => /poetry|poem|verse|chapbook/i.test(o.writing_types + ' ' + o.title));
    if (filter === 'fiction') f = f.filter(o => /fiction|novel|short story|flash/i.test(o.writing_types + ' ' + o.title));
    if (filter === 'nonfiction') f = f.filter(o => /nonfiction|essay|memoir/i.test(o.writing_types + ' ' + o.title));
    if (sort === 'deadline') f = [...f].sort((a, b) => (a._days ?? 9999) - (b._days ?? 9999));
    if (sort === 'effort') f = [...f].sort((a, b) => a._effort - b._effort);
    if (sort === 'award') f = [...f].sort((a, b) => (b.award_amount_numeric || 0) - (a.award_amount_numeric || 0));
    return f;
  }, [opps, filter, sort]);

  // Featured: largest award with future deadline
  const featured = useMemo(() => {
    return [...filtered].sort((a, b) => (b.award_amount_numeric || 0) - (a.award_amount_numeric || 0))[0];
  }, [filtered]);

  // Group rest by month
  const byMonth = useMemo(() => {
    const groups = {};
    filtered.forEach(o => {
      if (o.id === featured?.id) return;
      const key = o._date ? `${o._date.getFullYear()}-${String(o._date.getMonth()+1).padStart(2,'0')}` : 'rolling';
      groups[key] = groups[key] || [];
      groups[key].push(o);
    });
    return groups;
  }, [filtered, featured]);

  const monthKeys = Object.keys(byMonth).sort((a, b) => a === 'rolling' ? 1 : b === 'rolling' ? -1 : a.localeCompare(b));

  return (
    <div className="room-reading">
      <header className="reading-masthead">
        <div className="t-mono-tiny" style={{textAlign: 'center'}}>· The Reading Room ·</div>
        <h1 className="reading-title">A literary register, <em>set in type.</em></h1>
        <div className="t-mono-tiny" style={{textAlign:'center', color:'var(--ink-faint)', marginTop: 8}}>
          {filtered.length} opportunities, drawn this season
        </div>
      </header>

      <div className="reading-tools">
        <div className="reading-filters">
          {[
            ['all', 'All'],
            ['free', 'Free to enter'],
            ['this-month', 'Closing this month'],
            ['poetry', 'Poetry'],
            ['fiction', 'Fiction'],
            ['nonfiction', 'Nonfiction'],
          ].map(([v, l]) => (
            <button key={v} className={"reading-filter" + (filter === v ? ' on' : '')} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
        <div className="reading-sort">
          <span className="t-mono-tiny">arranged by</span>
          <select className="reading-sort-sel" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="curated">curator's hand</option>
            <option value="deadline">deadline, soonest</option>
            <option value="effort">effort, lightest</option>
            <option value="award">award, largest</option>
          </select>
        </div>
      </div>

      {featured && (
        <article className="reading-feature" onClick={() => openOpp(featured)}>
          <div className="feature-pin"><span className="pin"></span></div>
          <div className="feature-left">
            <div className="t-mono-tiny" style={{color:'var(--ochre-deep)'}}>· The Editor's Pick ·</div>
            <h2 className="feature-title">{featured.title}</h2>
            <div className="feature-org">{featured.organization}</div>
            <p className="feature-desc">{featured.description}</p>
            <div className="feature-meta">
              <span className="feature-meta-item">
                <em>award</em>
                <b>{featured._money || featured.award_amount}</b>
              </span>
              <span className="feature-meta-item">
                <em>fee</em>
                <b style={featured._isFree ? {color:'var(--moss)'} : null}>{featured._fee || featured.entry_fee}</b>
              </span>
              <span className="feature-meta-item">
                <em>closes</em>
                <b>{featured._date ? CP.fmtDate(featured._date, 'long') : 'rolling'}</b>
              </span>
              <span className="feature-meta-item">
                <em>effort</em>
                <b style={{fontStyle:'italic'}}>{featured._effortLabel}</b>
              </span>
            </div>
          </div>
          <div className="feature-right">
            <div className="feature-drop-cap">{featured.title[0]}</div>
          </div>
        </article>
      )}

      {monthKeys.map(key => {
        const items = byMonth[key];
        let label = 'Rolling deadlines';
        if (key !== 'rolling') {
          const [y, m] = key.split('-');
          label = CP.MONTHS_LONG[+m - 1] + ' ' + y;
        }
        return (
          <section key={key} className="reading-section">
            <div className="reading-section-head">
              <h3 className="reading-section-title">{label}</h3>
              <div className="reading-section-rule"></div>
              <span className="t-mono-tiny" style={{color:'var(--ink-faint)'}}>{items.length}</span>
            </div>
            <div className="reading-spread">
              {items.map(o => (
                <article key={o.id} className="reading-item" onClick={() => openOpp(o)}>
                  <div className="reading-item-date">
                    {o._date ? `${CP.MONTHS_SHORT[o._date.getMonth()]} ${o._date.getDate()}` : 'rolling'}
                  </div>
                  <h4 className="reading-item-title">{o.title}</h4>
                  <div className="reading-item-org">{o.organization}</div>
                  <p className="reading-item-desc">{(o.description || '').slice(0, 140)}…</p>
                  <div className="reading-item-foot">
                    {o.award_amount_numeric > 0 && <span><b>{o._money}</b></span>}
                    <span style={{color:'var(--ink-faint)'}}> · {o._isFree ? <em style={{color:'var(--moss)'}}>free</em> : o._fee}</span>
                    <span style={{color:'var(--ink-faint)'}}> · <em>{o._effortLabel}</em></span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ───── Year — twelve-month garden ─────
function RoomYear({ opps, state, setState, openOpp }) {
  const today = CP.TODAY;
  const startMonth = today.getMonth();
  const startYear = today.getFullYear();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const m = (startMonth + i) % 12;
    const y = startYear + Math.floor((startMonth + i) / 12);
    months.push({ m, y });
  }

  const planning = state.planning || [];
  const drafting = state.drafting || [];

  // Bucket opps by month
  const byMonth = useMemo(() => {
    const b = {};
    opps.forEach(o => {
      if (!o._date) return;
      const k = `${o._date.getFullYear()}-${o._date.getMonth()}`;
      b[k] = b[k] || [];
      b[k].push(o);
    });
    return b;
  }, [opps]);

  const togglePlan = (oppId) => {
    setState(s => {
      const has = (s.planning || []).includes(oppId);
      return { ...s, planning: has ? s.planning.filter(x => x !== oppId) : [...(s.planning || []), oppId] };
    });
  };

  return (
    <div className="room-year">
      <header className="year-head">
        <Folio left="The Year" right={`${months[0].y} → ${months[11].y}`} />
        <h1 className="t-display" style={{fontSize: 56, marginTop: 14}}>The <em>year</em> ahead</h1>
        <p className="year-blurb">
          Twelve months. Pin opportunities to plant them on the planner — see deadline density at a glance,
          space your effort, and protect the months you need to write.
        </p>
        <div className="year-legend">
          <span><span className="leg-dot" style={{background:'var(--ochre)'}}></span> on the planner</span>
          <span><span className="leg-dot" style={{background:'var(--indigo)'}}></span> drafting</span>
          <span><span className="leg-dot" style={{background:'var(--ink-ghost)'}}></span> available</span>
          <span><span className="leg-dot" style={{background:'var(--moss)'}}></span> free to enter</span>
        </div>
      </header>

      <div className="year-grid">
        {months.map(({ m, y }) => {
          const items = byMonth[`${y}-${m}`] || [];
          const planned = items.filter(o => planning.includes(o.id));
          const free = items.filter(o => o._isFree).length;
          const big = items.filter(o => (o.award_amount_numeric || 0) >= 5000).length;
          return (
            <section key={`${y}-${m}`} className="year-month">
              <header className="year-month-head">
                <div className="ym-name">
                  <span className="t-display" style={{fontSize: 28}}>{CP.MONTHS_SHORT[m]}</span>
                  <span className="t-mono-tiny" style={{marginLeft: 6, color:'var(--ink-faint)'}}>'{String(y).slice(2)}</span>
                </div>
                <div className="ym-meters">
                  <div className="ym-meter" title={`${items.length} deadlines this month`}>
                    <div className="ym-meter-num">{items.length}</div>
                    <div className="t-mono-tiny">close</div>
                  </div>
                  <div className="ym-meter" title={`${free} free to enter`}>
                    <div className="ym-meter-num" style={free > 0 ? {color:'var(--moss)'} : null}>{free}</div>
                    <div className="t-mono-tiny">free</div>
                  </div>
                  <div className="ym-meter" title={`${big} over $5K`}>
                    <div className="ym-meter-num" style={big > 0 ? {color:'var(--ochre-deep)'} : null}>{big}</div>
                    <div className="t-mono-tiny">5k+</div>
                  </div>
                </div>
              </header>

              {planned.length > 0 && (
                <div className="ym-planned">
                  <div className="t-mono-tiny" style={{color:'var(--ochre-deep)'}}>· on the planner ·</div>
                  {planned.map(o => (
                    <button key={o.id} className="ym-planned-row" onClick={() => openOpp(o)}>
                      <span className="pin" style={{flexShrink: 0}}></span>
                      <span style={{flex: 1, fontSize: 14, textAlign: 'left'}}>{o.title}</span>
                      <span className="t-mono-tiny">{o._date.getDate()}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="ym-list">
                {items.filter(o => !planning.includes(o.id)).slice(0, 6).map(o => (
                  <div key={o.id} className="ym-row">
                    <button className="ym-pin-btn" onClick={() => togglePlan(o.id)} title="Add to planner">+</button>
                    <button className="ym-row-main" onClick={() => openOpp(o)}>
                      <span className="ym-day">{o._date.getDate().toString().padStart(2,'0')}</span>
                      <span className="ym-title">{o.title}</span>
                      {o._isFree && <span className="ym-free">free</span>}
                    </button>
                  </div>
                ))}
                {items.length > 6 && (
                  <div className="t-mono-tiny" style={{textAlign:'center', padding:'8px 0', color:'var(--ink-faint)'}}>
                    + {items.length - 6} more
                  </div>
                )}
                {items.length === 0 && (
                  <p className="t-italic" style={{color:'var(--ink-faint)', fontSize: 14, padding:'8px 0', textAlign:'center'}}>
                    a quiet month.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

window.RoomReading = RoomReading;
window.RoomYear = RoomYear;
