import { useState, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = ({ onBack }) => {
  const [sessions, setSessions] = useState(() => {
    return JSON.parse(localStorage.getItem('formPuckSessions') || '[]');
  });

  useEffect(() => {
    // Initial load handled by lazy state initialization
  }, []);

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all session history?")) {
      localStorage.removeItem('formPuckSessions');
      setSessions([]);
    }
  };

  const totalReps = sessions.reduce((acc, curr) => acc + (curr.reps || 0), 0);
  const totalMinutes = Math.round(sessions.reduce((acc, curr) => acc + (curr.duration || 0), 0) / 60);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Analytics Dashboard</h1>
        <div className="dashboard-header-actions">
          <button onClick={clearHistory} className="dashboard-btn dashboard-btn-danger">
            Clear History
          </button>
          <button onClick={onBack} className="dashboard-btn dashboard-btn-primary">
            Back to Camera
          </button>
        </div>
      </div>

      <div className="dashboard-stats-grid">
        <div className="dashboard-stat-card">
          <h3 className="dashboard-stat-label">Total Sessions</h3>
          <p className="dashboard-stat-value">{sessions.length}</p>
        </div>
        <div className="dashboard-stat-card">
          <h3 className="dashboard-stat-label">Total Reps Recorded</h3>
          <p className="dashboard-stat-value green">{totalReps}</p>
        </div>
        <div className="dashboard-stat-card">
          <h3 className="dashboard-stat-label">Total Time</h3>
          <p className="dashboard-stat-value purple">{totalMinutes} mins</p>
        </div>
      </div>

      <h2 className="dashboard-section-title">Session History</h2>
      {sessions.length === 0 ? (
        <div className="dashboard-empty-state">
          <p>No sessions recorded yet. Go back to the camera and start a session!</p>
        </div>
      ) : (
        <div className="dashboard-table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Exercise</th>
                <th>Reps</th>
                <th>Duration (s)</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <tr key={session.id}>
                  <td>{new Date(session.date).toLocaleString()}</td>
                  <td style={{ fontWeight: '500' }}>{session.exercise}</td>
                  <td><span className="dashboard-table-reps">{session.reps}</span></td>
                  <td>{session.duration}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
