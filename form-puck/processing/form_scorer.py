import numpy as np
from processing.angle_calculator import AngleCalculator, EMASmoother


class FormScorer:
    def __init__(self, exercise_config):
        self._scoring_config = exercise_config["scoring"]
        self._angles_config = exercise_config.get("angles", {})
        self._landmark_map = exercise_config["landmarks"]
        self._faults_config = self._scoring_config["faults"]
        self._calc = AngleCalculator()
        self._smoother = EMASmoother(alpha=0.35)
        self._active_faults = set()

    def evaluate(self, landmarks, world_landmarks, rep_state, hip_velocity):
        """Evaluate form for current frame.

        Args:
            landmarks: Nx4 array from MediaPipe (x, y, z, visibility)
            world_landmarks: Nx3 array or None (x, y, z in meters)
            rep_state: current RepState
            hip_velocity: list of recent hip velocities
        Returns:
            dict with score, faults list, and per-angle metrics
        """
        if landmarks is None:
            return {"score": 0, "faults": [], "angles": {}, "is_good": True}

        self._world_landmarks = world_landmarks
        angles_config = self._angles_config

        # Calculate all relevant angles
        metrics = {}

        # Knee angle
        knee_pts = self._get_angle_points(landmarks, "knee")
        if knee_pts:
            knee_angle = self._calc.calculate_angle(*knee_pts)
            knee_pts_sec = self._get_angle_points_secondary(landmarks, "knee")
            knee_angle_sec = (
                self._calc.calculate_angle(*knee_pts_sec) if knee_pts_sec else knee_angle
            )
            metrics["knee_angle"] = self._smoother.smooth("knee_angle", (knee_angle + knee_angle_sec) / 2.0)
            metrics["knee_angle_left"] = self._smoother.smooth("knee_angle_left", knee_angle)
            metrics["knee_angle_right"] = self._smoother.smooth("knee_angle_right", knee_angle_sec)

        # Hip angle
        hip_pts = self._get_angle_points(landmarks, "hip")
        if hip_pts:
            hip_angle = self._calc.calculate_angle(*hip_pts)
            hip_pts_sec = self._get_angle_points_secondary(landmarks, "hip")
            hip_angle_sec = (
                self._calc.calculate_angle(*hip_pts_sec) if hip_pts_sec else hip_angle
            )
            metrics["hip_angle"] = self._smoother.smooth("hip_angle", (hip_angle + hip_angle_sec) / 2.0)

        # Back angle (forward lean from vertical) - use 3D world landmarks
        back_cfg = self._get_back_config()
        if back_cfg and world_landmarks is not None:
            pts_names = back_cfg.get("points", ["left_shoulder", "left_hip"])
            shoulder_idx = self._landmark_map.get(pts_names[0], 11)
            hip_idx = self._landmark_map.get(pts_names[1], 23)
            shoulder = self._calc.get_landmark_xyz(world_landmarks, shoulder_idx)
            hip = self._calc.get_landmark_xyz(world_landmarks, hip_idx)
            if shoulder is not None and hip is not None:
                metrics["back_angle"] = self._smoother.smooth("back_angle", self._calc.calculate_vertical_angle(shoulder, hip))

        # Elbow angle (for curl exercises)
        elbow_pts = self._get_angle_points(landmarks, "elbow")
        if elbow_pts:
            elbow_angle = self._calc.calculate_angle(*elbow_pts)
            elbow_pts_sec = self._get_angle_points_secondary(landmarks, "elbow")
            elbow_angle_sec = (
                self._calc.calculate_angle(*elbow_pts_sec) if elbow_pts_sec else elbow_angle
            )
            metrics["elbow_angle"] = self._smoother.smooth("elbow_angle", (elbow_angle + elbow_angle_sec) / 2.0)

        # Shoulder angle (for curl swing detection)
        shoulder_pts = self._get_angle_points(landmarks, "shoulder")
        if shoulder_pts:
            shoulder_angle = self._calc.calculate_angle(*shoulder_pts)
            shoulder_pts_sec = self._get_angle_points_secondary(landmarks, "shoulder")
            shoulder_angle_sec = (
                self._calc.calculate_angle(*shoulder_pts_sec) if shoulder_pts_sec else shoulder_angle
            )
            metrics["shoulder_angle"] = self._smoother.smooth("shoulder_angle", (shoulder_angle + shoulder_angle_sec) / 2.0)

        # Knee tracking (cave detection) - use 3D world landmarks
        if world_landmarks is not None:
            knee_cave = self._calculate_knee_cave_3d(world_landmarks)
            if knee_cave is not None:
                metrics["knee_cave"] = self._smoother.smooth("knee_cave", knee_cave)

        # Asymmetry
        if "knee_angle_left" in metrics and "knee_angle_right" in metrics:
            metrics["asymmetry"] = abs(
                metrics["knee_angle_left"] - metrics["knee_angle_right"]
            )

        # Evaluate faults - skip if not in an active rep state
        score = self._scoring_config["base_score"]
        active_faults = []
        current_state = rep_state.value if rep_state else "READY"

        for fault_name, fault_cfg in self._faults_config.items():
            # State-aware: only check during specified rep phases
            active_during = fault_cfg.get("active_during")
            if active_during and current_state not in active_during:
                # Clear the fault if it was active but we left the active phase
                self._active_faults.discard(fault_name)
                continue

            currently_active = fault_name in self._active_faults
            detected, value = self._check_fault(fault_name, fault_cfg, metrics, hip_velocity, currently_active)
            if detected:
                self._active_faults.add(fault_name)
                score -= fault_cfg["deduction"]
                active_faults.append({
                    "name": fault_name,
                    "description": fault_cfg["description"],
                    "value": value,
                    "deduction": fault_cfg["deduction"],
                })
            else:
                self._active_faults.discard(fault_name)

        score = max(0, score)

        return {
            "score": score,
            "faults": active_faults,
            "angles": metrics,
            "is_good": len(active_faults) == 0,
        }

    def _check_fault(self, fault_name, fault_cfg, metrics, hip_velocity, currently_active=False):
        """Check if a specific fault is detected using hysteresis. Returns (detected, value)."""
        value = None

        if fault_name == "back_rounding" or fault_name == "arching_back":
            value = metrics.get("back_angle")
        elif fault_name == "insufficient_depth" or fault_name == "half_rep":
            # half_rep uses elbow_angle for pushup (threshold > 100 = not deep enough)
            value = metrics.get("elbow_angle") if metrics.get("elbow_angle") is not None else metrics.get("knee_angle")
        elif fault_name == "knee_cave":
            value = metrics.get("knee_cave")
        elif fault_name == "asymmetric_descent":
            value = metrics.get("asymmetry")
        elif fault_name == "bounce_at_bottom":
            if len(hip_velocity) >= 2:
                vel_threshold = fault_cfg.get("velocity_threshold", 0.05)
                if hip_velocity[-1] < -vel_threshold and hip_velocity[-2] > vel_threshold:
                    return True, abs(hip_velocity[-1])
            return False, None
        elif fault_name == "bar_path_deviation":
            pass  # Requires wrist tracking, placeholder for deadlift
        elif fault_name == "hip_shoot":
            pass  # Requires multi-frame analysis, placeholder for deadlift
        elif fault_name == "elbow_swing" or fault_name == "elbow_flare":
            value = metrics.get("shoulder_angle")
        elif fault_name == "insufficient_contraction":
            value = metrics.get("elbow_angle")
        elif fault_name == "incomplete_lockout":
            # Elbow not fully extended: triggers when elbow_angle is below threshold
            value = metrics.get("elbow_angle")
        elif fault_name == "sagging_hips" or fault_name == "piking_hips":
            # Body alignment: deviation of hip angle from 180 (straight body)
            hip_angle = metrics.get("hip_angle")
            if hip_angle is not None:
                value = abs(180 - hip_angle)
        elif fault_name == "knee_over_toe":
            # Front knee too far forward: knee angle too small
            value = metrics.get("knee_angle")

        if value is None:
            return False, None

        trigger = fault_cfg["threshold_deg"]
        clear_margin = fault_cfg.get("clear_margin_deg", 5)
        direction = fault_cfg.get("direction", "above")

        if direction == "below":
            # Trigger when value falls below threshold (e.g. incomplete_lockout, knee_over_toe)
            if currently_active:
                if value >= trigger + clear_margin:
                    return False, value
                return True, value
            else:
                if value <= trigger:
                    return True, value
                return False, None
        else:
            # Trigger when value rises above threshold (default)
            if currently_active:
                if value <= trigger - clear_margin:
                    return False, value
                return True, value
            else:
                if value >= trigger:
                    return True, value
                return False, None

    def _get_angle_points(self, landmarks, angle_name):
        """Get primary side 3D points for angle calculation."""
        angles_cfg = self._angles_config
        cfg = angles_cfg.get(angle_name)
        if not cfg:
            return None
        names = cfg.get("points", [])
        if len(names) != 3:
            return None
        indices = [self._landmark_map.get(n) for n in names]
        if None in indices:
            return None
        # Prefer 3D world landmarks unless configured for 2D only
        use_2d = cfg.get("use_2d_only", False)
        wl = getattr(self, '_world_landmarks', None)
        if not use_2d and wl is not None:
            pts = [self._calc.get_landmark_xyz(wl, i) for i in indices]
            if all(p is not None for p in pts):
                return pts
        # Fallback to 2D
        return [self._calc.get_landmark_xy(landmarks, i) for i in indices]

    def _get_angle_points_secondary(self, landmarks, angle_name):
        """Get secondary side 3D points for angle calculation."""
        angles_cfg = self._angles_config
        cfg = angles_cfg.get(angle_name)
        if not cfg:
            return None
        names = cfg.get("points_secondary", [])
        if len(names) != 3:
            return None
        indices = [self._landmark_map.get(n) for n in names]
        if None in indices:
            return None
        use_2d = cfg.get("use_2d_only", False)
        wl = getattr(self, '_world_landmarks', None)
        if not use_2d and wl is not None:
            pts = [self._calc.get_landmark_xyz(wl, i) for i in indices]
            if all(p is not None for p in pts):
                return pts
        return [self._calc.get_landmark_xy(landmarks, i) for i in indices]

    def _get_back_config(self):
        angles_cfg = self._angles_config
        return angles_cfg.get("back")

    def _calculate_knee_cave(self, landmarks):
        """Calculate knee cave using 2D landmarks (fallback)."""
        lm = self._landmark_map
        left_knee = self._calc.get_landmark_xy(landmarks, lm.get("left_knee", 25))
        left_ankle = self._calc.get_landmark_xy(landmarks, lm.get("left_ankle", 27))
        left_foot = self._calc.get_landmark_xy(landmarks, lm.get("left_foot_index", 31))
        right_knee = self._calc.get_landmark_xy(landmarks, lm.get("right_knee", 26))
        right_ankle = self._calc.get_landmark_xy(landmarks, lm.get("right_ankle", 28))
        right_foot = self._calc.get_landmark_xy(landmarks, lm.get("right_foot_index", 32))
        left_cave = self._calc.calculate_knee_cave(left_knee, left_ankle, left_foot)
        right_cave = self._calc.calculate_knee_cave(right_knee, right_ankle, right_foot)
        return max(left_cave, right_cave)

    def _calculate_knee_cave_3d(self, world_landmarks):
        """Calculate knee cave using 3D world landmarks."""
        lm = self._landmark_map
        left_knee = self._calc.get_landmark_xyz(world_landmarks, lm.get("left_knee", 25))
        left_ankle = self._calc.get_landmark_xyz(world_landmarks, lm.get("left_ankle", 27))
        left_foot = self._calc.get_landmark_xyz(world_landmarks, lm.get("left_foot_index", 31))
        right_knee = self._calc.get_landmark_xyz(world_landmarks, lm.get("right_knee", 26))
        right_ankle = self._calc.get_landmark_xyz(world_landmarks, lm.get("right_ankle", 28))
        right_foot = self._calc.get_landmark_xyz(world_landmarks, lm.get("right_foot_index", 32))
        if any(p is None for p in [left_knee, left_ankle, left_foot, right_knee, right_ankle, right_foot]):
            return None
        left_cave = self._calc.calculate_knee_cave(left_knee, left_ankle, left_foot)
        right_cave = self._calc.calculate_knee_cave(right_knee, right_ankle, right_foot)
        return max(left_cave, right_cave)
