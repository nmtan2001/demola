import React from 'react';
import './App.css';
import CameraViewport from './components/CameraViewport';
import MetricsPanel from './components/MetricsPanel';
import { useExerciseAnalysis } from './hooks/useExerciseAnalysis';

import FormPuckWidget from './components/FormPuckWidget';

function App() {
  const { metrics, onPose, cycleExercise, activeExerciseName } = useExerciseAnalysis();

  // Compute LED states based on live metrics
  const ledStates = Array(5).fill('off');
  if (metrics.inRep) {
    const hasFaults = metrics.faults && metrics.faults.length > 0;
    for (let i = 0; i < 5; i++) {
      ledStates[i] = hasFaults ? 'red' : 'green';
    }
  }

  return (
    <div className="app">
      <div className="main-content" style={{ position: 'relative', width: '100%', height: '100%' }}>
        <CameraViewport onPose={onPose} />
        
        {/* Widget floats on top of the camera view */}
        <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', width: '250px', height: '250px', zIndex: 100 }}>
          <FormPuckWidget onClick={cycleExercise} ledStates={ledStates} />
        </div>
      </div>
      <MetricsPanel metrics={metrics} activeExerciseName={activeExerciseName} />
    </div>
  );
}

export default App;
