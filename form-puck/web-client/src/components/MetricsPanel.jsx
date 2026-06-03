

const MetricsPanel = ({ 
  metrics = {}, 
  activeExerciseName = '',
  isSessionActive = false,
  onStartSession,
  onEndSession,
  onViewDashboard
}) => {
  const { repCount = 0, liveScore = 100, angles = {}, faults = [] } = metrics;

  return (
    <div className="metrics-panel glass-panel">
      <h2>{activeExerciseName ? `${activeExerciseName} Metrics` : 'Metrics'}</h2>

      <div className="session-controls" style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!isSessionActive ? (
            <button 
              onClick={onStartSession}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Start Session
            </button>
          ) : (
            <button 
              onClick={onEndSession}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            >
              End Session
            </button>
          )}
        </div>
        <button 
          onClick={onViewDashboard}
          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
        >
          📊 View Dashboard
        </button>
      </div>
      
      <div className="metric-card">
        <span className="metric-label">Rep Count {isSessionActive ? '(Recording)' : '(Idle)'}</span>
        <span className="metric-value">{repCount}</span>
      </div>
      
      <div className="metric-card highlight">
        <span className="metric-label">Live Score</span>
        <span className="metric-value">{liveScore}%</span>
      </div>

      {faults.length > 0 && (
        <>
          <div className="faults-section" style={{ marginBottom: '0.5rem' }}>
            <h4 style={{ color: '#ef4444', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Indicators - What's Wrong</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {faults.map((fault, idx) => (
                <li key={idx} style={{ color: '#fca5a5', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                  {fault.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </li>
              ))}
            </ul>
          </div>
          <div className="feedback-section" style={{ marginBottom: '1rem' }}>
            <h4 style={{ color: '#22d3ee', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Feedback - What To Do</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {faults.map((fault, idx) => (
                <li key={idx} style={{ color: '#67e8f9', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                  {fault.description || fault.name}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      
      <div className="angles-section">
        <h3>Joint Angles</h3>
        <div className="angle-item">
          <span>Shoulder</span>
          <span>{angles.shoulder !== undefined ? `${angles.shoulder}°` : '--°'}</span>
        </div>
        <div className="angle-item">
          <span>Elbow</span>
          <span>{angles.elbow !== undefined ? `${angles.elbow}°` : '--°'}</span>
        </div>
        <div className="angle-item">
          <span>Hip</span>
          <span>{angles.hip !== undefined ? `${angles.hip}°` : '--°'}</span>
        </div>
        <div className="angle-item">
          <span>Knee</span>
          <span>{angles.knee !== undefined ? `${angles.knee}°` : '--°'}</span>
        </div>
      </div>
    </div>
  );
};

export default MetricsPanel;
