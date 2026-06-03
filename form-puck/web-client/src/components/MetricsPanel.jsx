import React from 'react';

const MetricsPanel = ({ metrics = {}, activeExerciseName = '' }) => {
  const { repCount = 0, liveScore = 100, angles = {}, faults = [] } = metrics;

  return (
    <div className="metrics-panel glass-panel">
      <h2>{activeExerciseName ? `${activeExerciseName} Metrics` : 'Metrics'}</h2>
      
      <div className="metric-card">
        <span className="metric-label">Rep Count</span>
        <span className="metric-value">{repCount}</span>
      </div>
      
      <div className="metric-card highlight">
        <span className="metric-label">Live Score</span>
        <span className="metric-value">{liveScore}%</span>
      </div>

      {faults.length > 0 && (
        <div className="faults-section" style={{ color: 'red', marginBottom: '1rem' }}>
          <h4>Feedback</h4>
          <ul>
            {faults.map((fault, idx) => (
              <li key={idx}>{fault.name}</li>
            ))}
          </ul>
        </div>
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
