// The Commonplace — main app shell

function App() {
  const [opps, setOpps] = useState(null);
  const [room, setRoom] = useState('today');
  const [drawerOpp, setDrawerOpp] = useState(null);
  const [aiOn, setAiOn] = useState(false);
  const [state, setStateRaw] = useState(CP.getState());

  const setState = (u) => setStateRaw(s => CP.setState(typeof u === 'function' ? u(s) : u));

  useEffect(() => {
    CP.loadOpps().then(setOpps);
    return CP.subscribe(s => setStateRaw({ ...s }));
  }, []);

  if (!opps) return <div style={{padding: 40, textAlign:'center', color:'var(--ink-faint)', fontStyle:'italic'}}>opening the book…</div>;

  const writer = state.writer;

  const openOpp = (o) => setDrawerOpp(o);
  const closeOpp = () => setDrawerOpp(null);
  const toggleSave = (o) => setState(s => ({ ...s, saved: (s.saved || []).includes(o.id) ? s.saved.filter(x => x !== o.id) : [...(s.saved || []), o.id] }));
  const togglePlan = (o) => setState(s => ({ ...s, planning: (s.planning || []).includes(o.id) ? s.planning.filter(x => x !== o.id) : [...(s.planning || []), o.id] }));

  const saved = state.saved || [];
  const planning = state.planning || [];
  const project = state.projects[0];

  return (
    <div className="cp-app paper-bg">
      <aside className="cp-rail">
        <div className="cp-brand">
          <div className="cp-brand-title">The Commonplace</div>
          <div className="cp-brand-sub">a writer's companion</div>
        </div>
        <nav className="cp-nav">
          {ROOMS.map(r => (
            <button key={r.id} className={"cp-nav-link" + (room === r.id ? ' on' : '')} onClick={() => setRoom(r.id)}>
              <Icon d={r.icon} size={14} />
              <div style={{flex: 1}}>
                {r.label}
                <span className="nav-hint">{r.hint}</span>
              </div>
            </button>
          ))}
        </nav>
        <div className="cp-foot">
          <div className="cp-foot-avatar">{writer.name[0]}</div>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{fontSize: 13, fontFamily:'var(--serif)'}}>{writer.name.split(' ')[0]}</div>
            <div className="t-mono-tiny" style={{marginTop: 1, color:'var(--ink-faint)'}}>{writer.stage}</div>
          </div>
          <button className={"ai-toggle" + (aiOn ? ' on' : '')} onClick={() => setAiOn(!aiOn)} title={aiOn ? 'Claude is helping' : 'AI off'}>
            {aiOn ? '● ai on' : 'ai off'}
          </button>
        </div>
      </aside>

      <main className="cp-main">
        {room === 'today' && <RoomToday opps={opps} state={state} setState={setState} openOpp={openOpp} aiOn={aiOn} />}
        {room === 'reading' && <RoomReading opps={opps} state={state} openOpp={openOpp} aiOn={aiOn} />}
        {room === 'year' && <RoomYear opps={opps} state={state} setState={setState} openOpp={openOpp} />}
        {room === 'project' && <RoomProject opps={opps} state={state} setState={setState} openOpp={openOpp} aiOn={aiOn} />}
        {room === 'pipeline' && <RoomPipeline opps={opps} state={state} setState={setState} openOpp={openOpp} />}
        {room === 'kit' && <RoomKit state={state} setState={setState} aiOn={aiOn} />}
        {room === 'ledger' && <RoomLedger state={state} aiOn={aiOn} />}
      </main>

      {drawerOpp && (
        <Drawer
          opp={drawerOpp}
          project={project}
          onClose={closeOpp}
          onSave={toggleSave}
          isSaved={saved.includes(drawerOpp.id)}
          onPlan={togglePlan}
          isPlanned={planning.includes(drawerOpp.id)}
          aiOn={aiOn}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
