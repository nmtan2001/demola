import React from 'react';
import './App.css';
import CameraViewport from './components/CameraViewport';
import MetricsPanel from './components/MetricsPanel';
import { useExerciseAnalysis } from './hooks/useExerciseAnalysis';

import FormPuckWidget from './components/FormPuckWidget';
import DemoSkeleton from './components/DemoSkeleton';

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

        {/* Corner widgets stack vertically */}
        <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', zIndex: 100, display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          {/* FormPuckWidget with live skeleton mapping */}
          <div style={{ width: '200px', height: '200px' }}>
            <FormPuckWidget onClick={cycleExercise} ledStates={ledStates} faults={metrics.faults} angles={metrics.angles} />
          </div>
          {/* Demo reference showing ideal form */}
          <div style={{ width: '150px', height: '200px', cursor: 'pointer' }} onClick={cycleExercise}>
            <DemoSkeleton exerciseName={activeExerciseName} />
          </div>
        </div>
      </div>
      <MetricsPanel metrics={metrics} activeExerciseName={activeExerciseName} />
    </div>
  );
}

export default App;
