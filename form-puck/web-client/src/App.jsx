import React from 'react';
import './App.css';
import CameraViewport from './components/CameraViewport';
import MetricsPanel from './components/MetricsPanel';
import { useExerciseAnalysis } from './hooks/useExerciseAnalysis';

import FormPuckWidget from './components/FormPuckWidget';
import DemoSkeleton from './components/DemoSkeleton';

function App() {
  const { metrics, onPose, cycleExercise, activeExerciseName } = useExerciseAnalysis();

  // 5 LEDs: Posture, Left Arm, Right Arm, Left Leg, Right Leg
  // Side-specific faults (elbow_swing_left, knee_cave_right, etc.) are generated
  // by FormScorer._checkFault using the SIDE_ARM_FAULTS / SIDE_LEG_FAULTS logic
  const POSTURE_FAULTS = ['back_rounding', 'arching_back', 'sagging_hips', 'piking_hips', 'hip_shoot', 'bar_path_deviation'];
  const LEFT_ARM_FAULTS = ['elbow_swing_left', 'elbow_flare_left', 'incomplete_lockout_left', 'insufficient_contraction', 'half_rep'];
  const RIGHT_ARM_FAULTS = ['elbow_swing_right', 'elbow_flare_right', 'incomplete_lockout_right', 'insufficient_contraction', 'half_rep'];
  const LEFT_LEG_FAULTS = ['knee_cave_left', 'insufficient_depth', 'knee_over_toe', 'bounce_at_bottom'];
  const RIGHT_LEG_FAULTS = ['knee_cave_right', 'insufficient_depth', 'knee_over_toe', 'bounce_at_bottom'];
  // Non-side-specific faults that affect all limbs
  const ALL_LIMBS_FAULTS = ['asymmetric_descent'];

  const isTracking = Object.values(metrics.angles).some(v => v !== '--');

  const ledStates = [
    isTracking ? (metrics.faults.some(f => POSTURE_FAULTS.includes(f.name)) ? 'red' : 'green') : 'off',         // LED 1: Posture
    isTracking ? (metrics.faults.some(f => LEFT_ARM_FAULTS.concat(ALL_LIMBS_FAULTS).includes(f.name)) ? 'red' : 'green') : 'off',   // LED 2: Left Arm
    isTracking ? (metrics.faults.some(f => RIGHT_ARM_FAULTS.concat(ALL_LIMBS_FAULTS).includes(f.name)) ? 'red' : 'green') : 'off',  // LED 3: Right Arm
    isTracking ? (metrics.faults.some(f => LEFT_LEG_FAULTS.concat(ALL_LIMBS_FAULTS).includes(f.name)) ? 'red' : 'green') : 'off',   // LED 4: Left Leg
    isTracking ? (metrics.faults.some(f => RIGHT_LEG_FAULTS.concat(ALL_LIMBS_FAULTS).includes(f.name)) ? 'red' : 'green') : 'off',  // LED 5: Right Leg
  ];

  return (
    <div className="app">
      <div className="main-content" style={{ position: 'relative', width: '100%', height: '100%' }}>
        <CameraViewport onPose={onPose} />

        {/* Corner widgets */}
        <div className="corner-widgets">
          <div className="puck-widget-wrap">
            <FormPuckWidget onClick={cycleExercise} ledStates={ledStates} />
          </div>
          <div className="demo-widget-wrap" onClick={cycleExercise}>
            <DemoSkeleton exerciseName={activeExerciseName} />
          </div>
        </div>
      </div>
      <MetricsPanel metrics={metrics} activeExerciseName={activeExerciseName} />
    </div>
  );
}

export default App;
