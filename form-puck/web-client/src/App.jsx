import React from 'react';
import './App.css';
import CameraViewport from './components/CameraViewport';
import MetricsPanel from './components/MetricsPanel';
import { useExerciseAnalysis } from './hooks/useExerciseAnalysis';

import FormPuckWidget from './components/FormPuckWidget';
import DemoSkeleton from './components/DemoSkeleton';

function App() {
  const { metrics, onPose, cycleExercise, activeExerciseName } = useExerciseAnalysis();

  // 5 LEDs: Head/Posture, Left Arm, Right Arm, Left Leg, Right Leg
  // Side-specific arm faults use _left/_right suffix from FormScorer
  const POSTURE_FAULTS = ['back_rounding', 'arching_back', 'sagging_hips', 'piking_hips', 'hip_shoot'];
  const LEFT_ARM_FAULTS = ['elbow_swing_left', 'elbow_flare_left', 'insufficient_contraction_left', 'incomplete_lockout_left', 'bar_path_deviation', 'half_rep'];
  const RIGHT_ARM_FAULTS = ['elbow_swing_right', 'elbow_flare_right', 'insufficient_contraction_right', 'incomplete_lockout_right', 'bar_path_deviation', 'half_rep'];
  const LEFT_LEG_FAULTS = ['knee_cave_left', 'insufficient_depth', 'half_rep', 'knee_over_toe', 'bounce_at_bottom', 'asymmetric_descent'];
  const RIGHT_LEG_FAULTS = ['knee_cave_right', 'insufficient_depth', 'half_rep', 'knee_over_toe', 'bounce_at_bottom', 'asymmetric_descent'];

  const isTracking = metrics.angles.shoulder !== '--' || metrics.angles.elbow !== '--' || metrics.angles.hip !== '--' || metrics.angles.knee !== '--';

  const ledStates = [
    isTracking ? (metrics.faults.some(f => POSTURE_FAULTS.includes(f.name)) ? 'red' : 'green') : 'off',       // LED 1: Head/Posture
    isTracking ? (metrics.faults.some(f => LEFT_ARM_FAULTS.includes(f.name)) ? 'red' : 'green') : 'off',       // LED 2: Left Arm
    isTracking ? (metrics.faults.some(f => RIGHT_ARM_FAULTS.includes(f.name)) ? 'red' : 'green') : 'off',      // LED 3: Right Arm
    isTracking ? (metrics.faults.some(f => LEFT_LEG_FAULTS.includes(f.name)) ? 'red' : 'green') : 'off',       // LED 4: Left Leg
    isTracking ? (metrics.faults.some(f => RIGHT_LEG_FAULTS.includes(f.name)) ? 'red' : 'green') : 'off',      // LED 5: Right Leg
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
