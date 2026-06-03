import React, { useState, useEffect } from 'react';

const Dashboard = ({ onBack }) => {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const savedSessions = JSON.parse(localStorage.getItem('formPuckSessions') || '[]');
    setSessions(savedSessions);
  }, []);

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all session history?")) {
      localStorage.removeItem('formPuckSessions');
      setSessions([]);
    }
  };

  return (
    <div style={{ padding: '2rem', width: '100%', height: '100%', overflowY: 'auto', backgroundColor: '#0f172a', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>Analytics Dashboard</h1>
        <div>
          <button 
            onClick={clearHistory}
            style={{ padding: '0.5rem 1rem', marginRight: '1rem', borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer' }}
          >
            Clear History
          </button>
          <button 
            onClick={onBack}
            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: 'white', cursor: 'pointer' }}
          >
            Back to Camera
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase' }}>Total Sessions</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>{sessions.length}</p>
        </div>
        <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase' }}>Total Reps Recorded</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
            {sessions.reduce((acc, curr) => acc + (curr.reps || 0), 0)}
          </p>
        </div>
        <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase' }}>Total Time</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#a855f7' }}>
            {Math.round(sessions.reduce((acc, curr) => acc + (curr.duration || 0), 0) / 60)} mins
          </p>
        </div>
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Session History</h2>
      {sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#1e293b', borderRadius: '12px', color: '#94a3b8' }}>
          <p>No sessions recorded yet. Go back to the camera and start a session!</p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', textAlign: 'left' }}>
                <th style={{ padding: '1rem', borderBottom: '1px solid #334155', color: '#94a3b8' }}>Date</th>
                <th style={{ padding: '1rem', borderBottom: '1px solid #334155', color: '#94a3b8' }}>Exercise</th>
                <th style={{ padding: '1rem', borderBottom: '1px solid #334155', color: '#94a3b8' }}>Reps</th>
                <th style={{ padding: '1rem', borderBottom: '1px solid #334155', color: '#94a3b8' }}>Duration (s)</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <tr key={session.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '1rem' }}>{new Date(session.date).toLocaleString()}</td>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{session.exercise}</td>
                  <td style={{ padding: '1rem', color: '#10b981', fontWeight: 'bold' }}>{session.reps}</td>
                  <td style={{ padding: '1rem' }}>{session.duration}s</td>
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
