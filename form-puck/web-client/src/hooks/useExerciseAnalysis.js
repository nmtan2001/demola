import { useState, useRef, useCallback, useEffect } from 'react';
import { ExerciseAnalyzer } from '../logic/ExerciseAnalyzer';
import { EXERCISE_CONFIGS } from '../config/exercises';

export const useExerciseAnalysis = () => {
  const [metrics, setMetrics] = useState({
    repCount: 0,
    liveScore: 100,
    angles: {
      shoulder: '--',
      elbow: '--',
      hip: '--',
      knee: '--'
    },
    faults: []
  });

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);

  const analyzerRef = useRef(null);
  const lastRepCountRef = useRef(0);

  const cycleExercise = useCallback(() => {
    if (isSessionActive) return; // Prevent changing exercise mid-session
    setActiveExerciseIndex(prev => (prev + 1) % EXERCISE_CONFIGS.length);
  }, [isSessionActive]);

  useEffect(() => {
    analyzerRef.current = new ExerciseAnalyzer(EXERCISE_CONFIGS[activeExerciseIndex]);
    lastRepCountRef.current = 0;
    setMetrics(prev => ({
      ...prev,
      repCount: 0,
      liveScore: 100,
      faults: []
    }));
    setIsSessionActive(false);
  }, [activeExerciseIndex]);

  const startSession = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.reset();
    }
    lastRepCountRef.current = 0;
    setMetrics(prev => ({
      ...prev,
      repCount: 0,
      liveScore: 100,
      faults: []
    }));
    setSessionStartTime(Date.now());
    setIsSessionActive(true);
  }, []);

  const endSession = useCallback(() => {
    setIsSessionActive(false);
    if (!sessionStartTime) return;

    const durationSeconds = Math.round((Date.now() - sessionStartTime) / 1000);
    const sessionData = {
      id: Date.now().toString(),
      exercise: EXERCISE_CONFIGS[activeExerciseIndex].name,
      date: new Date().toISOString(),
      reps: lastRepCountRef.current,
      duration: durationSeconds,
    };

    const existing = JSON.parse(localStorage.getItem('formPuckSessions') || '[]');
    localStorage.setItem('formPuckSessions', JSON.stringify([sessionData, ...existing]));
  }, [sessionStartTime, activeExerciseIndex]);

  const onPose = useCallback((results) => {
    if (!analyzerRef.current) return;

    const { poseLandmarks, poseWorldLandmarks } = results;
    
    // Analyze frame
    const { rep_info, form_eval } = analyzerRef.current.analyze(poseLandmarks, poseWorldLandmarks);

    // Update state
    setMetrics(prev => {
      const repCount = analyzerRef.current.repCount;
      const liveScore = form_eval ? Math.round(form_eval.score) : 100;
      
      const newAngles = { ...prev.angles };
      if (form_eval && form_eval.angles) {
        if (form_eval.angles.hip_angle != null) newAngles.hip = Math.round(form_eval.angles.hip_angle);
        if (form_eval.angles.knee_angle != null) newAngles.knee = Math.round(form_eval.angles.knee_angle);
        if (form_eval.angles.shoulder_angle != null) newAngles.shoulder = Math.round(form_eval.angles.shoulder_angle);
        if (form_eval.angles.elbow_angle != null) newAngles.elbow = Math.round(form_eval.angles.elbow_angle);
      }

      if (repCount > lastRepCountRef.current) {
        lastRepCountRef.current = repCount;
      }

      return {
        repCount,
        liveScore,
        angles: newAngles,
        faults: form_eval ? form_eval.faults : [],
        inRep: rep_info ? rep_info.in_rep : false
      };
    });

  }, []);

  const activeExerciseName = EXERCISE_CONFIGS[activeExerciseIndex].name;

  return { 
    metrics, 
    onPose, 
    cycleExercise, 
    activeExerciseName,
    isSessionActive,
    startSession,
    endSession
  };
};
