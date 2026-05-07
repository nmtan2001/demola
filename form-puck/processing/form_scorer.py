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

    def evaluate(self, landmarks, world_landmarks, rep_state, hip_velocity):
        """Evaluate form for current frame.

        Args:
            landmarks: Nx4 array from MediaPipe
            world_landmarks: Nx3 array or None
            rep_state: current RepState
            hip_velocity: list of recent hip velocities
        Returns:
            dict with score, faults list, and per-angle metrics
        """
        if landmarks is None:
            return {"score": 0, "faults": [], "angles": {}, "is_good": True}

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

        # Back angle (forward lean from vertical)
        back_cfg = self._get_back_config()
        if back_cfg:
            shoulder_idx = self._landmark_map.get("left_shoulder", 11)
            hip_idx = self._landmark_map.get("left_hip", 23)
            shoulder = self._calc.get_landmark_xy(landmarks, shoulder_idx)
            hip = self._calc.get_landmark_xy(landmarks, hip_idx)
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

        # Knee tracking (cave detection)
        knee_cave = self._calculate_knee_cave(landmarks)
        if knee_cave is not None:
            metrics["knee_cave"] = self._smoother.smooth("knee_cave", knee_cave)

        # Asymmetry
        if "knee_angle_left" in metrics and "knee_angle_right" in metrics:
            metrics["asymmetry"] = abs(
                metrics["knee_angle_left"] - metrics["knee_angle_right"]
            )

        # Evaluate faults
        score = self._scoring_config["base_score"]
        active_faults = []

        for fault_name, fault_cfg in self._faults_config.items():
            detected, value = self._check_fault(fault_name, fault_cfg, metrics, hip_velocity)
            if detected:
                score -= fault_cfg["deduction"]
                active_faults.append({
                    "name": fault_name,
                    "description": fault_cfg["description"],
                    "value": value,
                    "deduction": fault_cfg["deduction"],
                })

        score = max(0, score)

        return {
            "score": score,
            "faults": active_faults,
            "angles": metrics,
            "is_good": len(active_faults) == 0,
        }

    def _check_fault(self, fault_name, fault_cfg, metrics, hip_velocity):
        """Check if a specific fault is detected. Returns (detected, value)."""
        if fault_name == "back_rounding":
            angle = metrics.get("back_angle")
            if angle is not None and angle > fault_cfg["threshold_deg"]:
                return True, angle
        elif fault_name == "insufficient_depth":
            angle = metrics.get("knee_angle")
            if angle is not None and angle > fault_cfg["threshold_deg"]:
                return True, angle
        elif fault_name == "knee_cave":
            cave = metrics.get("knee_cave")
            if cave is not None and cave > fault_cfg["threshold_deg"]:
                return True, cave
        elif fault_name == "asymmetric_descent":
            asym = metrics.get("asymmetry")
            if asym is not None and asym > fault_cfg["threshold_deg"]:
                return True, asym
        elif fault_name == "bounce_at_bottom":
            if len(hip_velocity) >= 2:
                vel_threshold = fault_cfg.get("velocity_threshold", 0.05)
                # Bounce = rapid direction change (negative then positive quickly)
                if hip_velocity[-1] < -vel_threshold and hip_velocity[-2] > vel_threshold:
                    return True, abs(hip_velocity[-1])
        elif fault_name == "bar_path_deviation":
            pass  # Requires wrist tracking, placeholder for deadlift
        elif fault_name == "hip_shoot":
            pass  # Requires multi-frame analysis, placeholder for deadlift
        elif fault_name == "elbow_swing":
            angle = metrics.get("shoulder_angle")
            if angle is not None and angle > fault_cfg["threshold_deg"]:
                return True, angle
        elif fault_name == "insufficient_contraction":
            angle = metrics.get("elbow_angle")
            if angle is not None and angle > fault_cfg["threshold_deg"]:
                return True, angle
        return False, None

    def _get_angle_points(self, landmarks, angle_name):
        """Get primary side points for angle calculation."""
        angles_cfg = self._angles_config
        cfg = angles_cfg.get(angle_name)
        if not cfg:
            # Try reading from exercise root angles
            return None
        names = cfg.get("points", [])
        if len(names) != 3:
            return None
        indices = [self._landmark_map.get(n) for n in names]
        if None in indices:
            return None
        pts = [self._calc.get_landmark_xy(landmarks, i) for i in indices]
        return pts

    def _get_angle_points_secondary(self, landmarks, angle_name):
        """Get secondary side points for angle calculation."""
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
        pts = [self._calc.get_landmark_xy(landmarks, i) for i in indices]
        return pts

    def _get_back_config(self):
        angles_cfg = self._angles_config
        return angles_cfg.get("back")

    def _calculate_knee_cave(self, landmarks):
        """Calculate knee cave for both legs, return max."""
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
