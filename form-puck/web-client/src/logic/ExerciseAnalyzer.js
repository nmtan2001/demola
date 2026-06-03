import { EMASmoother, AngleCalculator } from './mathUtils.js';

export const RepState = {
  STANDING: 'STANDING',
  DESCENDING: 'DESCENDING',
  ACTIVE: 'ACTIVE',
  RETURN: 'RETURN'
};

export class SquatRepDetector {
  constructor(config, landmarkMap = {}, fps = 30) {
    this._state = RepState.STANDING;
    this._repCount = 0;
    this._smoother = new EMASmoother(0.3);
    this._inRep = false;
    this._reachedDepth = false;

    this._standMin = config.stand_min || 160;
    this._descentStart = config.descent_start || 145;
    this._bottomTarget = config.bottom_target || 90;
    this._direction = config.direction || 'decrease';
    this._use2dOnly = config.use_2d_only || false;

    this._holdTarget = config.peak_hold_frames || 3;
    this._holdCounter = 0;
    this._minRepFrames = config.min_rep_frames || 20;
    const timeoutSeconds = config.rep_timeout_seconds || 5.0;
    this._repTimeoutFrames = Math.max(1, Math.floor(timeoutSeconds * fps));
    this._repStartFrame = 0;
    this._frameCount = 0;

    const priNames = config.angle_points;
    const secNames = config.angle_points_secondary;
    
    this._primary = [23, 25, 27];
    if (priNames && landmarkMap) {
      const indices = priNames.map(n => landmarkMap[n]);
      if (indices.every(i => i != null)) {
        this._primary = indices;
      }
    }

    this._secondary = [24, 26, 28];
    if (secNames && landmarkMap) {
      const indices = secNames.map(n => landmarkMap[n]);
      if (indices.every(i => i != null)) {
        this._secondary = indices;
      }
    }
  }

  get state() { return this._state; }
  get repCount() { return this._repCount; }
  get inRep() { return this._inRep; }

  update(landmarks, worldLandmarks = null) {
    this._frameCount++;
    if (!landmarks) {
      if (this._inRep && this._frameCount - this._repStartFrame > this._repTimeoutFrames) {
        this._state = RepState.STANDING;
        this._inRep = false;
        this._reachedDepth = false;
        this._holdCounter = 0;
      }
      return this._makeResult(false);
    }

    let angle = this._getAngle(landmarks, worldLandmarks);
    if (angle === null) {
      return this._makeResult(false);
    }

    angle = this._smoother.smooth('primary', angle);
    let repCompleted = false;

    if (this._direction === 'increase') {
      repCompleted = this._updateIncrease(angle);
    } else {
      repCompleted = this._updateDecrease(angle);
    }

    return this._makeResult(repCompleted);
  }

  _updateDecrease(angle) {
    if (this._state === RepState.STANDING) {
      if (angle < this._descentStart) {
        this._state = RepState.DESCENDING;
        this._inRep = true;
        this._reachedDepth = false;
        this._holdCounter = 0;
        this._repStartFrame = this._frameCount;
      }
    } else if (this._state === RepState.DESCENDING) {
      if (this._frameCount - this._repStartFrame > this._repTimeoutFrames) {
        this._state = RepState.STANDING;
        this._inRep = false;
      } else if (angle < this._bottomTarget) {
        this._holdCounter++;
        if (this._holdCounter >= this._holdTarget) {
          this._reachedDepth = true;
          this._holdCounter = 0;
          this._state = RepState.ACTIVE;
        }
      } else if (angle > this._standMin) {
        this._state = RepState.STANDING;
        this._inRep = false;
      } else {
        this._holdCounter = 0;
      }
    } else if (this._state === RepState.ACTIVE) {
      if (this._frameCount - this._repStartFrame > this._repTimeoutFrames) {
        this._state = RepState.STANDING;
        this._inRep = false;
      } else if (angle > this._bottomTarget + 10) {
        this._state = RepState.RETURN;
      }
    } else if (this._state === RepState.RETURN) {
      if (this._frameCount - this._repStartFrame > this._repTimeoutFrames) {
        this._state = RepState.STANDING;
        this._inRep = false;
        this._reachedDepth = false;
      } else if (angle > this._standMin) {
        const duration = this._frameCount - this._repStartFrame;
        if (this._reachedDepth && duration >= this._minRepFrames) {
          this._repCount++;
          this._state = RepState.STANDING;
          this._inRep = false;
          this._reachedDepth = false;
          return true;
        }
        this._state = RepState.STANDING;
        this._inRep = false;
        this._reachedDepth = false;
      } else if (angle < this._bottomTarget + 10) {
        this._state = RepState.ACTIVE;
      }
    }
    return false;
  }

  _updateIncrease(angle) {
    if (this._state === RepState.STANDING) {
      if (angle > this._descentStart) {
        this._state = RepState.DESCENDING;
        this._inRep = true;
        this._reachedDepth = false;
        this._holdCounter = 0;
        this._repStartFrame = this._frameCount;
      }
    } else if (this._state === RepState.DESCENDING) {
      if (this._frameCount - this._repStartFrame > this._repTimeoutFrames) {
        this._state = RepState.STANDING;
        this._inRep = false;
      } else if (angle > this._standMin) {
        this._holdCounter++;
        if (this._holdCounter >= this._holdTarget) {
          this._reachedDepth = true;
          this._holdCounter = 0;
          this._state = RepState.ACTIVE;
        }
      } else if (angle < this._descentStart) {
        this._state = RepState.STANDING;
        this._inRep = false;
      } else {
        this._holdCounter = 0;
      }
    } else if (this._state === RepState.ACTIVE) {
      if (this._frameCount - this._repStartFrame > this._repTimeoutFrames) {
        this._state = RepState.STANDING;
        this._inRep = false;
      } else if (angle < this._standMin - 10) {
        this._state = RepState.RETURN;
      }
    } else if (this._state === RepState.RETURN) {
      if (this._frameCount - this._repStartFrame > this._repTimeoutFrames) {
        this._state = RepState.STANDING;
        this._inRep = false;
        this._reachedDepth = false;
      } else if (angle < this._bottomTarget) {
        const duration = this._frameCount - this._repStartFrame;
        if (this._reachedDepth && duration >= this._minRepFrames) {
          this._repCount++;
          this._state = RepState.STANDING;
          this._inRep = false;
          this._reachedDepth = false;
          return true;
        }
        this._state = RepState.STANDING;
        this._inRep = false;
      } else if (angle > this._standMin) {
        this._state = RepState.ACTIVE;
      }
    }
    return false;
  }

  _getAngle(landmarks, worldLandmarks = null) {
    const primary = this._primary;
    const secondary = this._secondary;
    
    let priVis = 0;
    for (const i of primary) priVis += (landmarks[i]?.visibility || 0);
    priVis /= primary.length;

    let secVis = 0;
    for (const i of secondary) secVis += (landmarks[i]?.visibility || 0);
    secVis /= secondary.length;

    const indices = priVis >= secVis ? primary : secondary;

    if (!this._use2dOnly && worldLandmarks) {
      const pts = indices.map(i => AngleCalculator.getLandmarkXyz(worldLandmarks, i));
      if (pts.every(p => p !== null)) {
        return AngleCalculator.calculateAngle(pts[0], pts[1], pts[2]);
      }
    }

    const pts = indices.map(i => AngleCalculator.getLandmarkXy(landmarks, i));
    return AngleCalculator.calculateAngle(pts[0], pts[1], pts[2]);
  }

  _makeResult(repCompleted) {
    return {
      state: this._state,
      rep_count: this._repCount,
      rep_completed: repCompleted,
      in_rep: this._inRep,
      hip_velocity: []
    };
  }

  reset() {
    this._state = RepState.STANDING;
    this._repCount = 0;
    this._inRep = false;
    this._reachedDepth = false;
    this._holdCounter = 0;
    this._frameCount = 0;
    this._repStartFrame = 0;
    this._smoother.reset();
  }
}

export class CurlRepDetector {
  constructor(config, landmarkMap, fps = 30) {
    this._state = RepState.STANDING;
    this._repCount = 0;
    this._landmarkMap = landmarkMap;
    this._smoother = new EMASmoother(0.3);
    
    this._extendedThreshold = config.extended_threshold || 150;
    this._contractedThreshold = config.contracted_threshold || 55;
    this._transitionBuffer = config.transition_buffer || 10;
    this._holdFrames = config.hold_frames || 3;
    this._use2dOnly = config.use_2d_only || false;
    
    this._holdCounter = 0;
    this._stabilityFrames = config.standing_stability_frames || 5;
    this._stabilityCounter = this._stabilityFrames;
    this._inRep = false;
    this._reachedTarget = false;
    this._minRepFrames = config.min_rep_frames || 18;
    
    const timeoutSeconds = config.rep_timeout_seconds || 5.0;
    this._repTimeoutFrames = Math.max(1, Math.floor(timeoutSeconds * fps));
    this._repStartFrame = 0;
    this._frameCount = 0;
  }

  get state() { return this._state; }
  get repCount() { return this._repCount; }
  get inRep() { return this._inRep; }

  update(landmarks, worldLandmarks = null) {
    this._frameCount++;
    if (!landmarks) {
      if (this._inRep && this._frameCount - this._repStartFrame > this._repTimeoutFrames) {
        this._state = RepState.STANDING;
        this._inRep = false;
        this._stabilityCounter = 0;
      }
      return this._makeResult(false);
    }

    let elbowAngle = this._getElbowAngle(landmarks, worldLandmarks);
    if (elbowAngle === null) {
      return this._makeResult(false);
    }

    elbowAngle = this._smoother.smooth('elbow', elbowAngle);
    let repCompleted = false;

    if (this._state === RepState.STANDING) {
      this._stabilityCounter++;
      if (this._stabilityCounter >= this._stabilityFrames && elbowAngle < this._extendedThreshold - this._transitionBuffer) {
        this._state = RepState.DESCENDING;
        this._inRep = true;
        this._reachedTarget = false;
        this._repStartFrame = this._frameCount;
      }
    } else if (this._state === RepState.DESCENDING) {
      if (this._frameCount - this._repStartFrame > this._repTimeoutFrames) {
        this._state = RepState.STANDING;
        this._inRep = false;
        this._stabilityCounter = 0;
      } else if (elbowAngle < this._contractedThreshold) {
        this._reachedTarget = true;
        this._state = RepState.ACTIVE;
        this._holdCounter = 0;
      } else if (elbowAngle > this._extendedThreshold) {
        this._state = RepState.STANDING;
        this._inRep = false;
      }
    } else if (this._state === RepState.ACTIVE) {
      if (this._frameCount - this._repStartFrame > this._repTimeoutFrames) {
        this._state = RepState.STANDING;
        this._inRep = false;
        this._stabilityCounter = 0;
      } else {
        this._holdCounter++;
        if (this._holdCounter >= this._holdFrames && elbowAngle > this._contractedThreshold + this._transitionBuffer) {
          this._state = RepState.RETURN;
          this._stabilityCounter = 0;
        }
      }
    } else if (this._state === RepState.RETURN) {
      if (this._frameCount - this._repStartFrame > this._repTimeoutFrames) {
        this._state = RepState.STANDING;
        this._inRep = false;
        this._stabilityCounter = 0;
      } else if (elbowAngle > this._extendedThreshold) {
        const duration = this._frameCount - this._repStartFrame;
        if (this._reachedTarget && duration >= this._minRepFrames) {
          this._repCount++;
          repCompleted = true;
        }
        this._state = RepState.STANDING;
        this._inRep = false;
        this._stabilityCounter = 0;
      } else if (elbowAngle < this._contractedThreshold) {
        this._state = RepState.ACTIVE;
      }
    }

    return this._makeResult(repCompleted);
  }

  _getElbowAngle(landmarks, worldLandmarks = null) {
    const lm = this._landmarkMap;
    const lIndices = [lm.left_shoulder || 11, lm.left_elbow || 13, lm.left_wrist || 15];
    const rIndices = [lm.right_shoulder || 12, lm.right_elbow || 14, lm.right_wrist || 16];
    
    const leftScore = this._getAvgVisibility(landmarks, lIndices);
    const rightScore = this._getAvgVisibility(landmarks, rIndices);

    const indices = leftScore >= rightScore ? lIndices : rIndices;

    if (!this._use2dOnly && worldLandmarks) {
      const pts = indices.map(i => AngleCalculator.getLandmarkXyz(worldLandmarks, i));
      if (pts.every(p => p !== null)) {
        return AngleCalculator.calculateAngle(pts[0], pts[1], pts[2]);
      }
    }

    const pts = indices.map(i => AngleCalculator.getLandmarkXy(landmarks, i));
    return AngleCalculator.calculateAngle(pts[0], pts[1], pts[2]);
  }

  _getAvgVisibility(landmarks, indices) {
    let sum = 0;
    let count = 0;
    for (const i of indices) {
      if (landmarks[i]) {
        sum += landmarks[i].visibility || 0;
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  _makeResult(repCompleted) {
    return {
      state: this._state,
      rep_count: this._repCount,
      rep_completed: repCompleted,
      in_rep: this._inRep,
      hip_velocity: []
    };
  }

  reset() {
    this._state = RepState.STANDING;
    this._repCount = 0;
    this._holdCounter = 0;
    this._stabilityCounter = this._stabilityFrames;
    this._inRep = false;
    this._reachedTarget = false;
    this._frameCount = 0;
    this._repStartFrame = 0;
    this._smoother.reset();
  }
}

export function createRepDetector(config, landmarkMap = {}, fps = 30) {
  const smType = config.state_machine || "descending_ascending";
  if (smType === "contracting_extending") {
    return new CurlRepDetector(config, landmarkMap, fps);
  }
  return new SquatRepDetector(config, landmarkMap, fps);
}

export class FormScorer {
  constructor(exerciseConfig) {
    this._scoringConfig = exerciseConfig.scoring || {};
    this._anglesConfig = exerciseConfig.angles || {};
    this._landmarkMap = exerciseConfig.landmarks || {};
    this._faultsConfig = this._scoringConfig.faults || {};
    this._smoother = new EMASmoother(0.35);
    this._activeFaults = new Set();
    this._backAngleAtBottom = null;
    this._worldLandmarks = null;
  }

  evaluate(landmarks, worldLandmarks, repState, hipVelocity) {
    if (!landmarks) {
      return { score: 100, faults: [], angles: {}, is_good: true };
    }

    this._worldLandmarks = worldLandmarks;
    const metrics = {};
    const currentState = repState || RepState.STANDING;

    // Knee angle
    const kneePts = this._getAnglePoints(landmarks, "knee");
    if (kneePts) {
      const kneeAngle = AngleCalculator.calculateAngle(...kneePts);
      const kneePtsSec = this._getAnglePointsSecondary(landmarks, "knee");
      const kneeAngleSec = kneePtsSec ? AngleCalculator.calculateAngle(...kneePtsSec) : kneeAngle;
      
      metrics.knee_angle = this._smoother.smooth("knee_angle", (kneeAngle + kneeAngleSec) / 2.0);
      metrics.knee_angle_left = this._smoother.smooth("knee_angle_left", kneeAngle);
      metrics.knee_angle_right = this._smoother.smooth("knee_angle_right", kneeAngleSec);
    }

    // Hip angle
    const hipPts = this._getAnglePoints(landmarks, "hip");
    if (hipPts) {
      const hipAngle = AngleCalculator.calculateAngle(...hipPts);
      const hipPtsSec = this._getAnglePointsSecondary(landmarks, "hip");
      const hipAngleSec = hipPtsSec ? AngleCalculator.calculateAngle(...hipPtsSec) : hipAngle;
      metrics.hip_angle = this._smoother.smooth("hip_angle", (hipAngle + hipAngleSec) / 2.0);
    }

    // Back angle
    const backCfg = this._anglesConfig.back;
    if (backCfg && worldLandmarks) {
      const ptsNames = backCfg.points || ["left_shoulder", "left_hip"];
      const shoulderIdx = this._landmarkMap[ptsNames[0]] ?? 11;
      const hipIdx = this._landmarkMap[ptsNames[1]] ?? 23;
      const shoulder = AngleCalculator.getLandmarkXyz(worldLandmarks, shoulderIdx);
      const hip = AngleCalculator.getLandmarkXyz(worldLandmarks, hipIdx);
      if (shoulder && hip) {
        metrics.back_angle = this._smoother.smooth("back_angle", AngleCalculator.calculateVerticalAngle(shoulder, hip));
      }
    }

    // Elbow angle
    const elbowPts = this._getAnglePoints(landmarks, "elbow");
    if (elbowPts) {
      const elbowAngle = AngleCalculator.calculateAngle(...elbowPts);
      const elbowPtsSec = this._getAnglePointsSecondary(landmarks, "elbow");
      const elbowAngleSec = elbowPtsSec ? AngleCalculator.calculateAngle(...elbowPtsSec) : elbowAngle;
      
      metrics.elbow_angle = this._smoother.smooth("elbow_angle", (elbowAngle + elbowAngleSec) / 2.0);
      metrics.elbow_angle_left = this._smoother.smooth("elbow_angle_left", elbowAngle);
      metrics.elbow_angle_right = this._smoother.smooth("elbow_angle_right", elbowAngleSec);
    }

    // Shoulder angle
    const shoulderPts = this._getAnglePoints(landmarks, "shoulder");
    if (shoulderPts) {
      const shoulderAngle = AngleCalculator.calculateAngle(...shoulderPts);
      const shoulderPtsSec = this._getAnglePointsSecondary(landmarks, "shoulder");
      const shoulderAngleSec = shoulderPtsSec ? AngleCalculator.calculateAngle(...shoulderPtsSec) : shoulderAngle;
      metrics.shoulder_angle = this._smoother.smooth("shoulder_angle", (shoulderAngle + shoulderAngleSec) / 2.0);
      metrics.shoulder_angle_left = this._smoother.smooth("shoulder_angle_left", shoulderAngle);
      metrics.shoulder_angle_right = this._smoother.smooth("shoulder_angle_right", shoulderAngleSec);
    }

    // Knee cave (per-side)
    if (worldLandmarks) {
      const kneeCave = this._calculateKneeCave3d(worldLandmarks);
      if (kneeCave.max !== null) {
        metrics.knee_cave = this._smoother.smooth("knee_cave", kneeCave.max);
      }
      if (kneeCave.left !== null) {
        metrics.knee_cave_left = this._smoother.smooth("knee_cave_left", kneeCave.left);
      }
      if (kneeCave.right !== null) {
        metrics.knee_cave_right = this._smoother.smooth("knee_cave_right", kneeCave.right);
      }
    }

    // Asymmetry
    if ("knee_angle_left" in metrics && "knee_angle_right" in metrics) {
      metrics.asymmetry = Math.abs(metrics.knee_angle_left - metrics.knee_angle_right);
    } else if ("elbow_angle_left" in metrics && "elbow_angle_right" in metrics) {
      metrics.asymmetry = Math.abs(metrics.elbow_angle_left - metrics.elbow_angle_right);
    }

    // Hip sag/pike
    if ("sagging_hips" in this._faultsConfig || "piking_hips" in this._faultsConfig) {
      if (worldLandmarks) {
        const lm = this._landmarkMap;
        const lShIdx = lm.left_shoulder ?? 11;
        const lHpIdx = lm.left_hip ?? 23;
        const lAnIdx = lm.left_ankle ?? 27;
        const rShIdx = lm.right_shoulder ?? 12;
        const rHpIdx = lm.right_hip ?? 24;
        const rAnIdx = lm.right_ankle ?? 28;

        const _lv = (i) => (landmarks[i] ? landmarks[i].visibility || 0 : 0);
        const lVis = (_lv(lShIdx) + _lv(lHpIdx) + _lv(lAnIdx)) / 3;
        const rVis = (_lv(rShIdx) + _lv(rHpIdx) + _lv(rAnIdx)) / 3;

        let shIdx = lShIdx, hpIdx = lHpIdx, anIdx = lAnIdx;
        if (rVis > lVis) {
          shIdx = rShIdx; hpIdx = rHpIdx; anIdx = rAnIdx;
        }

        const shW = AngleCalculator.getLandmarkXyz(worldLandmarks, shIdx);
        const hpW = AngleCalculator.getLandmarkXyz(worldLandmarks, hpIdx);
        const anW = AngleCalculator.getLandmarkXyz(worldLandmarks, anIdx);

        if (shW && hpW && anW) {
          const bodyVec = [anW[0] - shW[0], anW[1] - shW[1], anW[2] - shW[2]];
          const bodyLenSq = bodyVec[0]*bodyVec[0] + bodyVec[1]*bodyVec[1] + bodyVec[2]*bodyVec[2];
          
          if (bodyLenSq > 1e-12) {
            const hpShVec = [hpW[0] - shW[0], hpW[1] - shW[1], hpW[2] - shW[2]];
            let t = (hpShVec[0]*bodyVec[0] + hpShVec[1]*bodyVec[1] + hpShVec[2]*bodyVec[2]) / bodyLenSq;
            t = Math.max(0, Math.min(1, t));
            const linePtY = shW[1] + t * bodyVec[1];
            const hipSagRaw = (hpW[1] - linePtY) * 100;
            metrics.hip_sag = this._smoother.smooth("hip_sag", hipSagRaw);
          }
        }
      }
    }

    let score = this._scoringConfig.base_score || 100;
    const activeFaults = [];

    if ("hip_shoot" in this._faultsConfig && currentState === RepState.ACTIVE) {
      this._backAngleAtBottom = metrics.back_angle;
    }

    for (const [faultName, faultCfg] of Object.entries(this._faultsConfig)) {
      const activeDuring = faultCfg.active_during;
      if (activeDuring && !activeDuring.includes(currentState)) {
        this._activeFaults.delete(faultName);
        continue;
      }

      const currentlyActive = this._activeFaults.has(faultName);
      const { detected, value } = this._checkFault(faultName, faultCfg, metrics, hipVelocity || [], currentlyActive);

      if (detected) {
        this._activeFaults.add(faultName);
        score -= (faultCfg.deduction || 0);
        activeFaults.push({
          name: faultName,
          description: faultCfg.description,
          value: value,
          deduction: faultCfg.deduction || 0,
          direction: faultCfg.direction || "above"
        });
      } else {
        this._activeFaults.delete(faultName);
      }
    }

    // Side-specific checks for arm faults (elbow_swing, elbow_flare, insufficient_contraction, incomplete_lockout)
    const SIDE_ARM_FAULTS = ['elbow_swing', 'elbow_flare', 'incomplete_lockout'];
    const SIDE_LEG_FAULTS = ['knee_cave'];
    const SIDES = ['left', 'right'];

    for (const faultName of SIDE_ARM_FAULTS) {
      if (!(faultName in this._faultsConfig)) continue;
      const faultCfg = this._faultsConfig[faultName];
      const activeDuring = faultCfg.active_during;
      if (activeDuring && !activeDuring.includes(currentState)) {
        for (const side of SIDES) {
          this._activeFaults.delete(`${faultName}_${side}`);
        }
        continue;
      }

      for (const side of SIDES) {
        const sideFaultName = `${faultName}_${side}`;
        let sideValue;
        if (faultName === 'elbow_swing' || faultName === 'elbow_flare') {
          sideValue = side === 'left' ? metrics.shoulder_angle_left : metrics.shoulder_angle_right;
        } else {
          sideValue = side === 'left' ? metrics.elbow_angle_left : metrics.elbow_angle_right;
        }
        if (sideValue === undefined) continue;

        const wasActive = this._activeFaults.has(sideFaultName);
        const trigger = faultCfg.threshold_deg ?? faultCfg.threshold_cm ?? faultCfg.threshold_px;
        const clearMargin = faultCfg.clear_margin_deg ?? faultCfg.clear_margin_cm ?? faultCfg.clear_margin_px ?? 5;
        const direction = faultCfg.direction || "above";

        if (FormScorer._checkThreshold(sideValue, trigger, clearMargin, direction, wasActive)) {
          if (!this._activeFaults.has(sideFaultName)) {
            score -= (faultCfg.deduction || 0);
          }
          this._activeFaults.add(sideFaultName);
          activeFaults.push({
            name: sideFaultName,
            description: faultCfg.description,
            value: sideValue,
            deduction: faultCfg.deduction || 0,
            direction: faultCfg.direction || "above"
          });
        } else {
          this._activeFaults.delete(sideFaultName);
        }
      }
    }

    // Side-specific checks for knee cave
    for (const faultName of SIDE_LEG_FAULTS) {
      if (!(faultName in this._faultsConfig)) continue;
      const faultCfg = this._faultsConfig[faultName];
      const activeDuring = faultCfg.active_during;
      if (activeDuring && !activeDuring.includes(currentState)) {
        for (const side of SIDES) {
          this._activeFaults.delete(`${faultName}_${side}`);
        }
        continue;
      }

      for (const side of SIDES) {
        const sideFaultName = `${faultName}_${side}`;
        const sideValue = side === 'left' ? metrics.knee_cave_left : metrics.knee_cave_right;
        if (sideValue === undefined) continue;

        const wasActive = this._activeFaults.has(sideFaultName);
        const trigger = faultCfg.threshold_deg ?? faultCfg.threshold_cm ?? faultCfg.threshold_px;
        const clearMargin = faultCfg.clear_margin_deg ?? faultCfg.clear_margin_cm ?? faultCfg.clear_margin_px ?? 5;
        const direction = faultCfg.direction || "above";

        if (FormScorer._checkThreshold(sideValue, trigger, clearMargin, direction, wasActive)) {
          if (!this._activeFaults.has(sideFaultName)) {
            score -= (faultCfg.deduction || 0);
          }
          this._activeFaults.add(sideFaultName);
          activeFaults.push({
            name: sideFaultName,
            description: faultCfg.description,
            value: sideValue,
            deduction: faultCfg.deduction || 0,
            direction: faultCfg.direction || "above"
          });
        } else {
          this._activeFaults.delete(sideFaultName);
        }
      }
    }

    return {
      score: Math.max(0, score),
      faults: activeFaults,
      angles: metrics,
      is_good: activeFaults.length === 0
    };
  }

  clearRep() {
    this._activeFaults.clear();
    this._smoother.reset();
    this._backAngleAtBottom = null;
  }

  reset() {
    this.clearRep();
  }

  static _checkThreshold(value, trigger, clearMargin, direction, currentlyActive) {
    if (value === null || value === undefined) return false;
    if (direction === "below") {
      return currentlyActive ? value < trigger + clearMargin : value <= trigger;
    }
    return currentlyActive ? value > trigger - clearMargin : value >= trigger;
  }

  _checkFault(faultName, faultCfg, metrics, hipVelocity, currentlyActive) {
    let value = null;

    if (faultName === "back_rounding" || faultName === "arching_back") {
      value = metrics.back_angle;
    } else if (faultName === "insufficient_depth" || faultName === "half_rep") {
      if (metrics.elbow_angle !== undefined) {
        value = metrics.elbow_angle;
      } else {
        const mode = faultCfg.knee_angle_mode || "average";
        const left = metrics.knee_angle_left;
        const right = metrics.knee_angle_right;
        if (mode === "min" && left !== undefined && right !== undefined) {
          value = Math.min(left, right);
        } else if (mode === "max" && left !== undefined && right !== undefined) {
          value = Math.max(left, right);
        } else {
          value = metrics.knee_angle;
        }
      }
    } else if (faultName === "knee_cave") {
      value = metrics.knee_cave;
    } else if (faultName === "asymmetric_descent") {
      value = metrics.asymmetry;
    } else if (faultName === "bounce_at_bottom") {
      if (hipVelocity.length >= 3) {
        const velThreshold = faultCfg.velocity_threshold || 0.3;
        const n = hipVelocity.length;
        if (hipVelocity[n-3] > velThreshold && 
            hipVelocity[n-2] < -velThreshold && 
            hipVelocity[n-1] > velThreshold) {
          return { detected: true, value: Math.abs(hipVelocity[n-2]) };
        }
      }
      return { detected: false, value: null };
    } else if (faultName === "bar_path_deviation") {
      const lm = this._landmarkMap;
      const wl = this._worldLandmarks;
      if (wl) {
        const lWrist = AngleCalculator.getLandmarkXyz(wl, lm.left_wrist ?? 15);
        const lAnkle = AngleCalculator.getLandmarkXyz(wl, lm.left_ankle ?? 27);
        const rWrist = AngleCalculator.getLandmarkXyz(wl, lm.right_wrist ?? 16);
        const rAnkle = AngleCalculator.getLandmarkXyz(wl, lm.right_ankle ?? 28);
        if (lWrist && lAnkle && rWrist && rAnkle) {
          const _hdist = (w, a) => Math.hypot(w[0] - a[0], w[2] - a[2]) * 100;
          value = Math.max(_hdist(lWrist, lAnkle), _hdist(rWrist, rAnkle));
        }
      }
    } else if (faultName === "hip_shoot") {
      if (this._backAngleAtBottom !== null && metrics.back_angle !== undefined) {
        value = metrics.back_angle - this._backAngleAtBottom;
      }
    } else if (faultName === "elbow_swing" || faultName === "elbow_flare") {
      // Use max of left/right so a single-side swing is caught, not diluted by averaging
      value = Math.max(metrics.shoulder_angle_left || 0, metrics.shoulder_angle_right || 0) || metrics.shoulder_angle;
    } else if (faultName === "insufficient_contraction") {
      value = Math.min(metrics.elbow_angle_left != null ? metrics.elbow_angle_left : Infinity, metrics.elbow_angle_right != null ? metrics.elbow_angle_right : Infinity);
      if (!isFinite(value)) value = metrics.elbow_angle;
    } else if (faultName === "incomplete_lockout") {
      value = Math.max(metrics.elbow_angle_left || 0, metrics.elbow_angle_right || 0) || metrics.elbow_angle;
    } else if (faultName === "sagging_hips") {
      const sag = metrics.hip_sag;
      value = (sag !== undefined && sag > 0) ? sag : null;
    } else if (faultName === "piking_hips") {
      const sag = metrics.hip_sag;
      value = (sag !== undefined && sag < 0) ? -sag : null;
    } else if (faultName === "knee_over_toe") {
      const wl = this._worldLandmarks;
      const lm = this._landmarkMap;
      const mode = faultCfg.knee_angle_mode || "min";
      if (wl) {
        const sides = [
          [lm.left_knee ?? 25, lm.left_ankle ?? 27, lm.left_foot_index ?? 31],
          [lm.right_knee ?? 26, lm.right_ankle ?? 28, lm.right_foot_index ?? 32]
        ];
        const displacements = [];
        for (const [kIdx, aIdx, fIdx] of sides) {
          const knee = AngleCalculator.getLandmarkXyz(wl, kIdx);
          const ankle = AngleCalculator.getLandmarkXyz(wl, aIdx);
          const foot = AngleCalculator.getLandmarkXyz(wl, fIdx);
          if (knee && ankle && foot) {
            const fd = [foot[0] - ankle[0], 0, foot[2] - ankle[2]];
            const fdNorm = Math.hypot(fd[0], fd[2]);
            if (fdNorm >= 1e-6) {
              const fdNormVec = [fd[0]/fdNorm, 0, fd[2]/fdNorm];
              const kf = [knee[0] - foot[0], 0, knee[2] - foot[2]];
              displacements.push((kf[0]*fdNormVec[0] + kf[2]*fdNormVec[2]) * 100);
            }
          }
        }
        if (displacements.length > 0) {
          if (mode === "max") value = Math.max(...displacements);
          else if (mode === "average") value = displacements.reduce((a,b)=>a+b,0) / displacements.length;
          else value = Math.min(...displacements);
        }
      }
    }

    if (value === null || value === undefined) {
      return { detected: false, value: null };
    }

    const trigger = faultCfg.threshold_cm ?? faultCfg.threshold_px ?? faultCfg.threshold_deg;
    const clearMargin = faultCfg.clear_margin_cm ?? faultCfg.clear_margin_px ?? faultCfg.clear_margin_deg ?? 5;
    const direction = faultCfg.direction || "above";

    const detected = FormScorer._checkThreshold(value, trigger, clearMargin, direction, currentlyActive);
    if (detected) return { detected: true, value };
    if (currentlyActive) return { detected: false, value };
    return { detected: false, value: null };
  }

  _getAnglePoints(landmarks, angleName) {
    const cfg = this._anglesConfig[angleName];
    if (!cfg) return null;
    const names = cfg.points || [];
    if (names.length !== 3) return null;
    const indices = names.map(n => this._landmarkMap[n]);
    if (indices.includes(undefined)) return null;

    const use2d = cfg.use_2d_only || false;
    const wl = this._worldLandmarks;
    if (!use2d && wl) {
      const pts = indices.map(i => AngleCalculator.getLandmarkXyz(wl, i));
      if (pts.every(p => p !== null)) return pts;
    }
    return indices.map(i => AngleCalculator.getLandmarkXy(landmarks, i));
  }

  _getAnglePointsSecondary(landmarks, angleName) {
    const cfg = this._anglesConfig[angleName];
    if (!cfg) return null;
    const names = cfg.points_secondary || [];
    if (names.length !== 3) return null;
    const indices = names.map(n => this._landmarkMap[n]);
    if (indices.includes(undefined)) return null;

    const use2d = cfg.use_2d_only || false;
    const wl = this._worldLandmarks;
    if (!use2d && wl) {
      const pts = indices.map(i => AngleCalculator.getLandmarkXyz(wl, i));
      if (pts.every(p => p !== null)) return pts;
    }
    return indices.map(i => AngleCalculator.getLandmarkXy(landmarks, i));
  }

  _calculateKneeCave3d(worldLandmarks) {
    const lm = this._landmarkMap;
    const lKnee = AngleCalculator.getLandmarkXyz(worldLandmarks, lm.left_knee ?? 25);
    const lAnkle = AngleCalculator.getLandmarkXyz(worldLandmarks, lm.left_ankle ?? 27);
    const lFoot = AngleCalculator.getLandmarkXyz(worldLandmarks, lm.left_foot_index ?? 31);

    const rKnee = AngleCalculator.getLandmarkXyz(worldLandmarks, lm.right_knee ?? 26);
    const rAnkle = AngleCalculator.getLandmarkXyz(worldLandmarks, lm.right_ankle ?? 28);
    const rFoot = AngleCalculator.getLandmarkXyz(worldLandmarks, lm.right_foot_index ?? 32);

    let leftVal = null, rightVal = null;
    if (lKnee && lAnkle && lFoot) {
      leftVal = AngleCalculator.calculateKneeCave(lKnee, lAnkle, lFoot);
    }
    if (rKnee && rAnkle && rFoot) {
      rightVal = AngleCalculator.calculateKneeCave(rKnee, rAnkle, rFoot);
    }

    const values = [leftVal, rightVal].filter(v => v !== null);
    return {
      left: leftVal,
      right: rightVal,
      max: values.length ? Math.max(...values) : null
    };
  }
}

export class ExerciseAnalyzer {
  constructor(exerciseConfig, fps = 30) {
    this._config = exerciseConfig;
    this._id = exerciseConfig.id || exerciseConfig.name;
    this._name = exerciseConfig.name;
    this._landmarkMap = exerciseConfig.landmarks || {};
    this._repDetector = createRepDetector(exerciseConfig.rep_detection || {}, this._landmarkMap, fps);
    this._formScorer = new FormScorer(exerciseConfig);
    
    this._currentEvaluation = null;
    this._repFaultsAccumulated = {};
    this._repFaultAbsentFrames = {};
    this._repScores = [];
    this._primaryMovementAngle = this._inferPrimaryMovementAngle();
    this._repIdealDistance = {};
    this._initRepQualityTracking();
  }

  get exerciseId() { return this._id; }
  get name() { return this._name; }
  get repCount() { return this._repDetector.repCount; }
  get state() { return this._repDetector.state; }
  get currentEvaluation() { return this._currentEvaluation; }

  analyze(landmarks, worldLandmarks, hipVelocity = null) {
    if (!hipVelocity) hipVelocity = [];

    const wasInRep = this._repDetector.inRep;
    const repInfo = this._repDetector.update(landmarks, worldLandmarks);

    if (!wasInRep && this._repDetector.inRep) {
      this._repFaultsAccumulated = {};
      this._repFaultAbsentFrames = {};
      this._repScores = [];
      this._initRepQualityTracking();
      this._formScorer.clearRep();
    }

    if (!landmarks) {
      const formEval = this._currentEvaluation || {
        score: 100, faults: [], angles: {}, is_good: true
      };
      this._currentEvaluation = formEval;
      return { rep_info: repInfo, form_eval: formEval };
    }

    const formEval = this._formScorer.evaluate(landmarks, worldLandmarks, repInfo.state, hipVelocity);

    if (this._repDetector.inRep && landmarks) {
      this._repScores.push(formEval.score);
      this._updateRepQualityTracking(formEval.angles);
      const currentFaultNames = new Set(formEval.faults.map(f => f.name));

      for (const fault of formEval.faults) {
        const name = fault.name;
        if (!this._repFaultsAccumulated[name]) {
          this._repFaultsAccumulated[name] = { ...fault };
        } else {
          if (fault.value !== null) {
            const prevVal = this._repFaultsAccumulated[name].value;
            const direction = fault.direction || "above";
            if (direction === "below") {
              if (prevVal === null || fault.value < prevVal) {
                this._repFaultsAccumulated[name].value = fault.value;
              }
            } else {
              if (prevVal === null || fault.value > prevVal) {
                this._repFaultsAccumulated[name].value = fault.value;
              }
            }
          }
        }
      }

      for (const name of Object.keys(this._repFaultsAccumulated)) {
        if (!currentFaultNames.has(name)) {
          this._repFaultAbsentFrames[name] = (this._repFaultAbsentFrames[name] || 0) + 1;
          if (this._repFaultAbsentFrames[name] >= 3) {
            delete this._repFaultsAccumulated[name];
            delete this._repFaultAbsentFrames[name];
          }
        } else {
          delete this._repFaultAbsentFrames[name];
        }
      }
    }

    if (repInfo.rep_completed) {
      const baseScore = this._formScorer._scoringConfig.base_score || 100;
      const finalFaults = Object.values(this._repFaultsAccumulated);
      const qualityAssessment = this._computeRepQualityAssessment();
      const qualityPenalty = qualityAssessment.penalty;

      if (qualityPenalty > 0) {
        finalFaults.push(this._buildQualityPenaltyFault(qualityAssessment));
      }

      let deductions = 0;
      for (const f of finalFaults) deductions += f.deduction;

      const faultBasedScore = Math.max(0, baseScore - deductions);

      let consistencyScore = faultBasedScore;
      if (this._repScores.length > 0) {
        const sum = this._repScores.reduce((acc, s) => acc + s, 0);
        const avg = sum / this._repScores.length;
        const min = Math.min(...this._repScores);
        // Bias toward stricter scoring: transiently poor form still affects final score.
        consistencyScore = (avg * 0.65) + (min * 0.35);
      }

      const finalScore = Math.max(0, Math.min(faultBasedScore, consistencyScore));
      
      repInfo.form_score = Math.round(finalScore * 10) / 10;
      repInfo.faults = finalFaults;
      repInfo.quality_penalty = Math.round(qualityPenalty * 10) / 10;

      formEval.score = repInfo.form_score;
      formEval.faults = finalFaults;
      formEval.is_good = finalFaults.length === 0;

      this._repFaultsAccumulated = {};
      this._repFaultAbsentFrames = {};
      this._repScores = [];
      this._initRepQualityTracking();
    }

    this._currentEvaluation = formEval;

    return {
      rep_info: repInfo,
      form_eval: formEval
    };
  }

  reset() {
    this._repDetector.reset();
    this._formScorer.reset();
    this._currentEvaluation = null;
    this._repFaultsAccumulated = {};
    this._repFaultAbsentFrames = {};
    this._repScores = [];
    this._initRepQualityTracking();
  }

  _inferPrimaryMovementAngle() {
    const angles = this._config.angles || {};
    const repCfg = this._config.rep_detection || {};
    const inferredByRepPoints = this._inferAngleNameFromRepDetection();

    if (inferredByRepPoints && angles[inferredByRepPoints]) {
      return inferredByRepPoints;
    }

    if (repCfg.state_machine === 'contracting_extending' && angles.elbow) {
      return 'elbow';
    }

    if (repCfg.direction === 'increase' && angles.elbow) {
      return 'elbow';
    }

    if (angles.knee) return 'knee';
    if (angles.elbow) return 'elbow';
    if (angles.hip) return 'hip';

    for (const [name, cfg] of Object.entries(angles)) {
      if (cfg?.ideal_min != null && cfg?.ideal_max != null) {
        return name;
      }
    }

    return null;
  }

  _inferAngleNameFromRepDetection() {
    const repCfg = this._config.rep_detection || {};
    const candidates = [repCfg.angle_points, repCfg.angle_points_secondary];

    for (const points of candidates) {
      if (!Array.isArray(points) || points.length !== 3) continue;
      const centerPointName = String(points[1]).toLowerCase();

      if (centerPointName.includes('knee')) return 'knee';
      if (centerPointName.includes('hip')) return 'hip';
      if (centerPointName.includes('elbow')) return 'elbow';
      if (centerPointName.includes('shoulder')) return 'shoulder';
    }

    return null;
  }

  _initRepQualityTracking() {
    this._repIdealDistance = {};
    const angles = this._config.angles || {};

    for (const [angleName, cfg] of Object.entries(angles)) {
      if (cfg?.ideal_min == null || cfg?.ideal_max == null) continue;
      this._repIdealDistance[angleName] = Number.POSITIVE_INFINITY;
    }
  }

  _updateRepQualityTracking(metrics = {}) {
    for (const angleName of Object.keys(this._repIdealDistance)) {
      const cfg = this._config.angles?.[angleName];
      if (!cfg) continue;

      const value = metrics[`${angleName}_angle`];
      if (value == null || Number.isNaN(value)) continue;

      const distance = ExerciseAnalyzer._distanceToRange(value, cfg.ideal_min, cfg.ideal_max);
      if (distance < this._repIdealDistance[angleName]) {
        this._repIdealDistance[angleName] = distance;
      }
    }
  }

  _computeRepQualityAssessment() {
    let penalty = 0;
    let primaryDistance = 0;
    let primarySpan = 1;
    let primarySource = this._primaryMovementAngle || null;

    for (const [angleName, bestDistance] of Object.entries(this._repIdealDistance)) {
      if (!Number.isFinite(bestDistance) || bestDistance <= 0) continue;

      const cfg = this._config.angles?.[angleName];
      if (!cfg) continue;

      const span = Math.max(1, Math.abs((cfg.ideal_max ?? 0) - (cfg.ideal_min ?? 0)));
      const normalizedDistance = bestDistance / span;

      const maxDeduction = angleName === this._primaryMovementAngle ? 30 : 10;
      penalty += Math.min(maxDeduction, normalizedDistance * maxDeduction);

      if (angleName === this._primaryMovementAngle) {
        primaryDistance = bestDistance;
        primarySpan = span;
        primarySource = angleName;
      }
    }

    return {
      penalty,
      primaryDistance,
      primarySpan,
      primarySource
    };
  }

  _buildQualityPenaltyFault(qualityAssessment) {
    const angleName = qualityAssessment.primarySource || this._primaryMovementAngle || 'movement';
    const shortfallDeg = Math.max(0, qualityAssessment.primaryDistance || 0);
    const normalized = Math.min(1, shortfallDeg / Math.max(1, qualityAssessment.primarySpan || 1));

    let guidance = 'Use fuller range of motion';
    if (angleName === 'knee') guidance = 'Go deeper and complete the range';
    else if (angleName === 'hip') guidance = 'Complete the hip hinge range';
    else if (angleName === 'elbow') guidance = 'Complete the elbow range';
    else if (angleName === 'shoulder') guidance = 'Complete the shoulder range';

    return {
      name: `insufficient_range_of_motion_${angleName}`,
      description: guidance,
      value: Math.round((normalized * 100) * 10) / 10,
      deduction: Math.round((qualityAssessment.penalty || 0) * 10) / 10,
      direction: 'above'
    };
  }

  static _distanceToRange(value, min, max) {
    if (value < min) return min - value;
    if (value > max) return value - max;
    return 0;
  }
}
