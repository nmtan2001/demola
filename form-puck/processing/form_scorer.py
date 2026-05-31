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
        self._back_angle_at_bottom = None

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
            # No pose detected: no faults can be measured, return baseline score
            return {"score": 100, "faults": [], "angles": {}, "is_good": True}

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
            metrics["elbow_angle_left"] = self._smoother.smooth("elbow_angle_left", elbow_angle)
            metrics["elbow_angle_right"] = self._smoother.smooth("elbow_angle_right", elbow_angle_sec)

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

        # Asymmetry - prefer knee angles; fall back to elbow angles for exercises
        # without knee-angle metrics (e.g. push-up), making asymmetric_descent reachable.
        if "knee_angle_left" in metrics and "knee_angle_right" in metrics:
            metrics["asymmetry"] = abs(
                metrics["knee_angle_left"] - metrics["knee_angle_right"]
            )
        elif "elbow_angle_left" in metrics and "elbow_angle_right" in metrics:
            metrics["asymmetry"] = abs(
                metrics["elbow_angle_left"] - metrics["elbow_angle_right"]
            )

        # Hip sag / pike (for push-up body-line check).
        # Only computed when the exercise actually defines one of these faults,
        # preventing meaningless values and smoother pollution on unrelated exercises.
        # Uses 2D landmarks; y increases downward in image coords.
        # hip_sag > 0 → hips drooping below shoulder-ankle line (sagging)
        # hip_sag < 0 → hips above shoulder-ankle line (piking)
        if any(f in self._faults_config for f in ("sagging_hips", "piking_hips")):
            wl = getattr(self, '_world_landmarks', None)
            if wl is not None:
                # Visibility-based side selection using 2D landmark confidence scores.
                l_sh_idx = self._landmark_map.get("left_shoulder", 11)
                l_hp_idx = self._landmark_map.get("left_hip", 23)
                l_an_idx = self._landmark_map.get("left_ankle", 27)
                r_sh_idx = self._landmark_map.get("right_shoulder", 12)
                r_hp_idx = self._landmark_map.get("right_hip", 24)
                r_an_idx = self._landmark_map.get("right_ankle", 28)
                def _lv(i):
                    return landmarks[i][3] if i is not None and i < len(landmarks) else 0.0
                l_vis = (_lv(l_sh_idx) + _lv(l_hp_idx) + _lv(l_an_idx)) / 3
                r_vis = (_lv(r_sh_idx) + _lv(r_hp_idx) + _lv(r_an_idx)) / 3
                if l_vis >= r_vis:
                    sh_idx, hp_idx, an_idx = l_sh_idx, l_hp_idx, l_an_idx
                else:
                    sh_idx, hp_idx, an_idx = r_sh_idx, r_hp_idx, r_an_idx
                sh_w = self._calc.get_landmark_xyz(wl, sh_idx)
                hp_w = self._calc.get_landmark_xyz(wl, hp_idx)
                an_w = self._calc.get_landmark_xyz(wl, an_idx)
                if sh_w is not None and hp_w is not None and an_w is not None:
                    # 3D vector projection of the hip onto the shoulder→ankle body-line.
                    # Using the full 3D dot-product avoids the X-axis clamping problem
                    # that occurs with same-side landmarks (sx ≈ ax → t clamps to 1.0).
                    # MediaPipe world Y increases downward, so positive sag = hips below line.
                    sh_v = np.array([float(sh_w[0]), float(sh_w[1]), float(sh_w[2])])
                    an_v = np.array([float(an_w[0]), float(an_w[1]), float(an_w[2])])
                    hp_v = np.array([float(hp_w[0]), float(hp_w[1]), float(hp_w[2])])
                    body_vec = an_v - sh_v
                    body_len_sq = float(np.dot(body_vec, body_vec))
                    if body_len_sq > 1e-12:
                        t = float(np.dot(hp_v - sh_v, body_vec)) / body_len_sq
                        t = max(0.0, min(1.0, t))
                        line_pt = sh_v + t * body_vec
                        hip_sag_raw = (float(hp_v[1]) - float(line_pt[1])) * 100  # metres → cm
                        metrics["hip_sag"] = self._smoother.smooth("hip_sag", hip_sag_raw)

        # Evaluate faults - skip if not in an active rep state
        score = self._scoring_config["base_score"]
        active_faults = []
        current_state = rep_state.value if rep_state else "READY"

        # Store peak back angle so hip_shoot can detect worsening posture during return.
        # Must be after current_state is assigned.
        if "hip_shoot" in self._faults_config and current_state == "PEAK":
            self._back_angle_at_bottom = metrics.get("back_angle")

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
                    "direction": fault_cfg.get("direction", "above"),
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

    def clear_rep(self):
        """Clear per-rep hysteresis and EMA state so stale angles from one rep
        do not bias the fault checks at the start of the next rep."""
        self._active_faults.clear()
        self._smoother.reset()
        self._back_angle_at_bottom = None

    def reset(self):
        """Reset all session state: hysteresis latch and EMA smoother history."""
        self._active_faults.clear()
        self._smoother.reset()
        self._back_angle_at_bottom = None

    def _check_fault(self, fault_name, fault_cfg, metrics, hip_velocity, currently_active=False):
        """Check if a specific fault is detected using hysteresis. Returns (detected, value)."""
        value = None

        if fault_name == "back_rounding" or fault_name == "arching_back":
            value = metrics.get("back_angle")
        elif fault_name == "insufficient_depth" or fault_name == "half_rep":
            # half_rep uses elbow_angle for pushup (threshold > 100 = not deep enough).
            # For lower-body exercises, use the knee angle of the most-bent leg when
            # knee_angle_mode = "min" is set (e.g. lunge front leg), otherwise the
            # bilateral average.
            elbow = metrics.get("elbow_angle")
            if elbow is not None:
                value = elbow
            else:
                mode = fault_cfg.get("knee_angle_mode", "average")
                left = metrics.get("knee_angle_left")
                right = metrics.get("knee_angle_right")
                if mode == "min" and left is not None and right is not None:
                    value = min(left, right)
                elif mode == "max" and left is not None and right is not None:
                    value = max(left, right)
                else:
                    value = metrics.get("knee_angle")
        elif fault_name == "knee_cave":
            value = metrics.get("knee_cave")
        elif fault_name == "asymmetric_descent":
            value = metrics.get("asymmetry")
        elif fault_name == "bounce_at_bottom":
            # Require sustained downward momentum over at least two consecutive frames
            # before flagging a reversal as a bounce.  A single sign-flip also occurs
            # in every controlled rep at the turnaround, so demanding that hip_velocity
            # was consistently positive for the two frames prior filters out normal
            # deceleration-then-reversal from a genuine elastic bounce.
            # A true bounce shows a rapid oscillation at the bottom:
            # fast descent (+), brief elastic upward rebound (-), re-descent (+).
            # The previous "+,+,-" pattern fires on every normal controlled rep
            # turnaround.  The "+,-,+" pattern only fires when the direction
            # reverses *twice* in quick succession, which is the elastic bounce.
            if len(hip_velocity) >= 3:
                vel_threshold = fault_cfg.get("velocity_threshold", 0.3)
                if (hip_velocity[-3] > vel_threshold and
                        hip_velocity[-2] < -vel_threshold and
                        hip_velocity[-1] > vel_threshold):
                    return True, abs(hip_velocity[-2])
            return False, None
        elif fault_name == "bar_path_deviation":
            lm = self._landmark_map
            wl = getattr(self, '_world_landmarks', None)
            if wl is not None:
                left_wrist = self._calc.get_landmark_xyz(wl, lm.get("left_wrist", 15))
                left_ankle = self._calc.get_landmark_xyz(wl, lm.get("left_ankle", 27))
                right_wrist = self._calc.get_landmark_xyz(wl, lm.get("right_wrist", 16))
                right_ankle = self._calc.get_landmark_xyz(wl, lm.get("right_ankle", 28))
                if all(p is not None for p in [left_wrist, left_ankle, right_wrist, right_ankle]):
                    # Total horizontal distance (X + Z) between wrist and ankle.
                    # Camera-orientation independent: measures how far the bar has
                    # drifted from directly above the ankle regardless of which
                    # direction the camera faces.  Z-only was wrong for side views.
                    def _hdist(w, a):
                        dx = float(w[0]) - float(a[0])
                        dz = float(w[2]) - float(a[2])
                        return np.hypot(dx, dz) * 100  # metres -> cm
                    left_dev = _hdist(left_wrist, left_ankle)
                    right_dev = _hdist(right_wrist, right_ankle)
                    value = max(left_dev, right_dev)
        elif fault_name == "hip_shoot":
            # True hip-before-chest: back_angle INCREASES during return (hips extend
            # faster than the torso).  Use the back angle captured at the peak (BOTTOM
            # state) as a reference; fire when the return back_angle exceeds it by
            # more than threshold_deg, indicating the torso is falling further forward
            # as the hips drive up.
            ref = self._back_angle_at_bottom
            current_ba = metrics.get("back_angle")
            if ref is not None and current_ba is not None:
                value = current_ba - ref  # positive = more forward lean than at peak
        elif fault_name == "elbow_swing" or fault_name == "elbow_flare":
            value = metrics.get("shoulder_angle")
        elif fault_name == "insufficient_contraction":
            value = metrics.get("elbow_angle")
        elif fault_name == "incomplete_lockout":
            # Elbow not fully extended: triggers when elbow_angle is below threshold
            value = metrics.get("elbow_angle")
        elif fault_name == "sagging_hips":
            # Positive hip_sag means hips are below the shoulder-ankle line
            sag = metrics.get("hip_sag")
            value = sag if (sag is not None and sag > 0) else None
        elif fault_name == "piking_hips":
            # Negative hip_sag means hips are above the shoulder-ankle line
            sag = metrics.get("hip_sag")
            value = -sag if (sag is not None and sag < 0) else None
        elif fault_name == "knee_over_toe":
            # Measure how far the knee is forward of the toe along the direction
            # the foot is pointing (ankle → foot_index), projected onto the
            # horizontal plane.  This is camera-orientation independent: it gives
            # the same result whether the subject faces the camera or faces away.
            # Positive = knee is ahead of (past) the toe in the foot direction.
            wl = getattr(self, '_world_landmarks', None)
            lm = self._landmark_map
            mode = fault_cfg.get("knee_angle_mode", "min")
            if wl is not None:
                displacements = []
                sides = [
                    (lm.get("left_knee", 25), lm.get("left_ankle", 27), lm.get("left_foot_index", 31)),
                    (lm.get("right_knee", 26), lm.get("right_ankle", 28), lm.get("right_foot_index", 32)),
                ]
                for knee_idx, ankle_idx, foot_idx in sides:
                    knee = self._calc.get_landmark_xyz(wl, knee_idx)
                    ankle = self._calc.get_landmark_xyz(wl, ankle_idx)
                    foot = self._calc.get_landmark_xyz(wl, foot_idx)
                    if knee is None or ankle is None or foot is None:
                        continue
                    # Foot-pointing direction (horizontal projection only)
                    fd = np.array([float(foot[0]) - float(ankle[0]), 0.0, float(foot[2]) - float(ankle[2])])
                    fd_norm = float(np.linalg.norm(fd))
                    if fd_norm < 1e-6:
                        continue
                    fd /= fd_norm
                    # Component of (knee - foot_index) along foot direction
                    kf = np.array([float(knee[0]) - float(foot[0]), 0.0, float(knee[2]) - float(foot[2])])
                    displacements.append(float(np.dot(kf, fd)) * 100)  # metres → cm
                if displacements:
                    if mode == "max":
                        value = max(displacements)
                    elif mode == "average":
                        value = sum(displacements) / len(displacements)
                    else:
                        value = min(displacements)

        if value is None:
            return False, None

        # bar_path_deviation uses threshold_cm; sagging/piking use threshold_px; all others use threshold_deg
        trigger = fault_cfg.get("threshold_cm", fault_cfg.get("threshold_px", fault_cfg.get("threshold_deg")))
        clear_margin = fault_cfg.get("clear_margin_cm", fault_cfg.get("clear_margin_px", fault_cfg.get("clear_margin_deg", 5)))
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
        """Calculate knee cave using 3D world landmarks, per-side.

        Returns the maximum cave angle of whichever sides have complete landmark
        data.  A single missing foot_index landmark no longer suppresses both sides.
        """
        lm = self._landmark_map
        left_knee = self._calc.get_landmark_xyz(world_landmarks, lm.get("left_knee", 25))
        left_ankle = self._calc.get_landmark_xyz(world_landmarks, lm.get("left_ankle", 27))
        left_foot = self._calc.get_landmark_xyz(world_landmarks, lm.get("left_foot_index", 31))
        right_knee = self._calc.get_landmark_xyz(world_landmarks, lm.get("right_knee", 26))
        right_ankle = self._calc.get_landmark_xyz(world_landmarks, lm.get("right_ankle", 28))
        right_foot = self._calc.get_landmark_xyz(world_landmarks, lm.get("right_foot_index", 32))
        values = []
        if left_knee is not None and left_ankle is not None and left_foot is not None:
            values.append(self._calc.calculate_knee_cave(left_knee, left_ankle, left_foot))
        if right_knee is not None and right_ankle is not None and right_foot is not None:
            values.append(self._calc.calculate_knee_cave(right_knee, right_ankle, right_foot))
        return max(values) if values else None
