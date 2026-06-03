import React from 'react';
import './App.css';
import CameraViewport from './components/CameraViewport';
import MetricsPanel from './components/MetricsPanel';
import { useExerciseAnalysis } from './hooks/useExerciseAnalysis';

import FormPuckWidget from './components/FormPuckWidget';
import DemoSkeleton from './components/DemoSkeleton';

function App() {
  const { metrics, onPose, cycleExercise, activeExerciseName } = useExerciseAnalysis();

  // Fault-to-LED-segment mapping: 5 LEDs = Head, Arms, Torso, Legs, Overall
  const ARM_FAULTS = ['elbow_swing', 'elbow_flare', 'insufficient_contraction', 'incomplete_lockout', 'bar_path_deviation'];
  const TORSO_FAULTS = ['back_rounding', 'arching_back', 'sagging_hips', 'piking_hips', 'hip_shoot'];
  const LEG_FAULTS = ['insufficient_depth', 'half_rep', 'knee_cave', 'knee_over_toe', 'bounce_at_bottom', 'asymmetric_descent'];

  const isTracking = metrics.angles.shoulder !== '--' || metrics.angles.elbow !== '--' || metrics.angles.hip !== '--' || metrics.angles.knee !== '--';

  const hasArmFault = metrics.faults.some(f => ARM_FAULTS.includes(f.name));
  const hasTorsoFault = metrics.faults.some(f => TORSO_FAULTS.includes(f.name));
  const hasLegFault = metrics.faults.some(f => LEG_FAULTS.includes(f.name));
  const hasAnyFault = metrics.faults.length > 0;

  const ledStates = [
    isTracking ? 'green' : 'off',                    // LED 1: Head
    isTracking ? (hasArmFault ? 'red' : 'green') : 'off',    // LED 2: Arms
    isTracking ? (hasTorsoFault ? 'red' : 'green') : 'off',  // LED 3: Torso
    isTracking ? (hasLegFault ? 'red' : 'green') : 'off',    // LED 4: Legs
    isTracking ? (hasAnyFault ? 'red' : 'green') : 'off',    // LED 5: Overall
  ];

  return (
    <div className="app">
      <div className="main-content" style={{ position: 'relative', width: '100%', height: '100%' }}>
        <CameraViewport onPose={onPose} />

        {/* Corner widgets stack vertically */}
        <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', zIndex: 100, display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          {/* FormPuckWidget with live skeleton mapping */}
          <div style={{ width: '200px', height: '200px' }}>
            <FormPuckWidget onClick={cycleExercise} ledStates={ledStates} />
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
