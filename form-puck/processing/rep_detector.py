import enum
import numpy as np
from processing.angle_calculator import AngleCalculator, EMASmoother


class RepState(enum.Enum):
    STANDING = "READY"
    DESCENDING = "ACTIVE"
    BOTTOM = "PEAK"
    ASCENDING = "RETURN"
    EXTENDED = "READY"
    CONTRACTING = "ACTIVE"
    CONTRACTED = "PEAK"
    EXTENDING = "RETURN"


class SquatRepDetector:
    """Generic angle-based 4-state rep detector.

    Supports two directions:
    - "decrease" (default): angle goes high -> low -> high (squat, pushup, lunge, deadlift)
    - "increase": angle goes low -> high -> low (overhead press)

    Includes minimum hold at peak, minimum rep duration, and rollback conditions.
    """

    DEFAULT_PRIMARY = (23, 25, 27)
    DEFAULT_SECONDARY = (24, 26, 28)

    def __init__(self, config, landmark_map=None):
        self._state = RepState.STANDING
        self._rep_count = 0
        self._smoother = EMASmoother(alpha=0.3)
        self._calc = AngleCalculator()
        self._in_rep = False
        self._reached_depth = False

        self._stand_min = config.get("stand_min", 160)
        self._descent_start = config.get("descent_start", 145)
        self._bottom_target = config.get("bottom_target", 90)
        self._direction = config.get("direction", "decrease")
        self._use_2d_only = config.get("use_2d_only", False)

        # Robustness
        self._hold_target = config.get("peak_hold_frames", 3)
        self._hold_counter = 0
        self._min_rep_frames = config.get("min_rep_frames", 20)
        self._rep_start_frame = 0
        self._frame_count = 0

        # Angle point resolution
        lm = landmark_map or {}
        pri_names = config.get("angle_points")
        sec_names = config.get("angle_points_secondary")
        if pri_names and lm:
            indices = [lm.get(n) for n in pri_names]
            self._primary = tuple(indices) if all(i is not None for i in indices) else self.DEFAULT_PRIMARY
        else:
            self._primary = self.DEFAULT_PRIMARY
        if sec_names and lm:
            indices = [lm.get(n) for n in sec_names]
            self._secondary = tuple(indices) if all(i is not None for i in indices) else self.DEFAULT_SECONDARY
        else:
            self._secondary = self.DEFAULT_SECONDARY

    @property
    def state(self):
        return self._state

    @property
    def rep_count(self):
        return self._rep_count

    @property
    def in_rep(self):
        return self._in_rep

    def update(self, landmarks, world_landmarks=None):
        self._frame_count += 1
        if landmarks is None:
            return self._make_result(False)

        angle = self._get_angle(landmarks, world_landmarks)
        if angle is None:
            return self._make_result(False)

        angle = self._smoother.smooth("primary", angle)

        if self._direction == "increase":
            rep_completed = self._update_increase(angle)
        else:
            rep_completed = self._update_decrease(angle)

        return self._make_result(rep_completed)

    def _update_decrease(self, angle):
        """Angle decreases then increases (squat, pushup, lunge, deadlift)."""

        if self._state == RepState.STANDING:
            if angle < self._descent_start:
                self._state = RepState.DESCENDING
                self._in_rep = True
                self._reached_depth = False
                self._hold_counter = 0
                self._rep_start_frame = self._frame_count

        elif self._state == RepState.DESCENDING:
            if angle < self._bottom_target:
                self._hold_counter += 1
                if self._hold_counter >= self._hold_target:
                    self._reached_depth = True
                    self._state = RepState.BOTTOM
            elif angle > self._stand_min:
                # Aborted - went back to standing without reaching bottom
                self._state = RepState.STANDING
                self._in_rep = False
            else:
                # In descent range but not at target - reset hold counter
                self._hold_counter = 0
                if self._frame_count - self._rep_start_frame > 150:
                    # Timeout after 5 seconds in descent
                    self._state = RepState.STANDING
                    self._in_rep = False

        elif self._state == RepState.BOTTOM:
            if angle > self._bottom_target + 10:
                self._state = RepState.ASCENDING

        elif self._state == RepState.ASCENDING:
            if angle > self._stand_min:
                duration = self._frame_count - self._rep_start_frame
                if self._reached_depth and duration >= self._min_rep_frames:
                    self._rep_count += 1
                    self._state = RepState.STANDING
                    self._in_rep = False
                    self._reached_depth = False
                    return True
                self._state = RepState.STANDING
                self._in_rep = False
                self._reached_depth = False
            elif angle < self._bottom_target + 10:
                # Dropped back into bottom range
                self._state = RepState.BOTTOM

        return False

    def _update_increase(self, angle):
        """Angle increases then decreases (overhead press).

        STANDING = low angle (arms bent), BOTTOM = high angle (arms locked).
        stand_min = peak threshold, bottom_target = rest threshold.
        """

        if self._state == RepState.STANDING:
            if angle > self._descent_start:
                self._state = RepState.DESCENDING
                self._in_rep = True
                self._reached_depth = False
                self._hold_counter = 0
                self._rep_start_frame = self._frame_count

        elif self._state == RepState.DESCENDING:
            if angle > self._stand_min:
                self._hold_counter += 1
                if self._hold_counter >= self._hold_target:
                    self._reached_depth = True
                    self._state = RepState.BOTTOM
            elif angle < self._bottom_target:
                # Never reached peak, aborted
                self._state = RepState.STANDING
                self._in_rep = False
            else:
                # In active range but not at peak - reset hold counter
                self._hold_counter = 0
                if self._frame_count - self._rep_start_frame > 150:
                    self._state = RepState.STANDING
                    self._in_rep = False

        elif self._state == RepState.BOTTOM:
            if angle < self._stand_min - 10:
                self._state = RepState.ASCENDING

        elif self._state == RepState.ASCENDING:
            if angle < self._descent_start:
                duration = self._frame_count - self._rep_start_frame
                if self._reached_depth and duration >= self._min_rep_frames:
                    self._rep_count += 1
                    self._state = RepState.STANDING
                    self._in_rep = False
                    self._reached_depth = False
                    return True
                self._state = RepState.STANDING
                self._in_rep = False
            elif angle > self._stand_min:
                # Went back up to peak
                self._state = RepState.BOTTOM

        return False

    def _get_angle(self, landmarks, world_landmarks=None):
        """Get the primary joint angle from the more visible side. Prefers 3D."""
        primary = self._primary
        secondary = self._secondary
        pri_vis = sum(landmarks[i][3] for i in primary) / len(primary)
        sec_vis = sum(landmarks[i][3] for i in secondary) / len(secondary)

        indices = primary if pri_vis >= sec_vis else secondary

        if not self._use_2d_only and world_landmarks is not None:
            pts = [self._calc.get_landmark_xyz(world_landmarks, i) for i in indices]
            if all(p is not None for p in pts):
                return self._calc.calculate_angle(*pts)

        pts = [self._calc.get_landmark_xy(landmarks, i) for i in indices]
        return self._calc.calculate_angle(*pts)

    def _make_result(self, rep_completed):
        return {
            "state": self._state,
            "rep_count": self._rep_count,
            "rep_completed": rep_completed,
            "in_rep": self._in_rep,
            "hip_velocity": [],
        }

    def reset(self):
        self._state = RepState.STANDING
        self._rep_count = 0
        self._in_rep = False
        self._reached_depth = False
        self._hold_counter = 0
        self._smoother.reset()


class CurlRepDetector:
    """Rep detector for curl-type exercises using elbow angle.

    EXTENDED (high angle) -> CONTRACTING -> CONTRACTED (low angle) -> EXTENDING -> EXTENDED (count).
    Includes minimum rep duration and rollback conditions.
    """

    def __init__(self, config, landmark_map):
        self._state = RepState.EXTENDED
        self._rep_count = 0
        self._landmark_map = landmark_map
        self._calc = AngleCalculator()
        self._smoother = EMASmoother(alpha=0.3)
        self._extended_threshold = config.get("extended_threshold", 150)
        self._contracted_threshold = config.get("contracted_threshold", 55)
        self._transition_buffer = config.get("transition_buffer", 10)
        self._hold_frames = config.get("hold_frames", 3)
        self._use_2d_only = config.get("use_2d_only", False)
        self._hold_counter = 0
        self._stability_frames = config.get("standing_stability_frames", 5)
        self._stability_counter = 0
        self._in_rep = False
        self._reached_target = False
        self._min_rep_frames = config.get("min_rep_frames", 18)
        self._rep_start_frame = 0
        self._frame_count = 0

    @property
    def state(self):
        return self._state

    @property
    def rep_count(self):
        return self._rep_count

    @property
    def in_rep(self):
        return self._in_rep

    def update(self, landmarks, world_landmarks=None):
        self._frame_count += 1
        if landmarks is None:
            return self._make_result(False)

        elbow_angle = self._get_elbow_angle(landmarks, world_landmarks)
        if elbow_angle is None:
            return self._make_result(False)

        elbow_angle = self._smoother.smooth("elbow", elbow_angle)
        rep_completed = False

        if self._state == RepState.EXTENDED:
            if elbow_angle < self._extended_threshold - self._transition_buffer:
                self._state = RepState.CONTRACTING
                self._in_rep = True
                self._reached_target = False
                self._rep_start_frame = self._frame_count

        elif self._state == RepState.CONTRACTING:
            if elbow_angle < self._contracted_threshold:
                self._reached_target = True
                self._state = RepState.CONTRACTED
                self._hold_counter = 0
            elif elbow_angle > self._extended_threshold:
                # Aborted - arm went back to extended without curling
                self._state = RepState.EXTENDED
                self._in_rep = False

        elif self._state == RepState.CONTRACTED:
            self._hold_counter += 1
            if elbow_angle > self._contracted_threshold + self._transition_buffer:
                self._state = RepState.EXTENDING
                self._stability_counter = 0

        elif self._state == RepState.EXTENDING:
            if elbow_angle > self._extended_threshold:
                duration = self._frame_count - self._rep_start_frame
                if self._reached_target and duration >= self._min_rep_frames:
                    self._rep_count += 1
                    rep_completed = True
                self._state = RepState.EXTENDED
                self._in_rep = False
            elif elbow_angle < self._contracted_threshold:
                # Dropped back to fully contracted
                self._state = RepState.CONTRACTED

        return self._make_result(rep_completed)

    def _get_elbow_angle(self, landmarks, world_landmarks=None):
        """Get elbow angle from the more visible side. Prefers 3D world landmarks."""
        lm = self._landmark_map
        left_score = self._get_avg_visibility(landmarks, [
            lm.get("left_shoulder", 11), lm.get("left_elbow", 13),
            lm.get("left_wrist", 15),
        ])
        right_score = self._get_avg_visibility(landmarks, [
            lm.get("right_shoulder", 12), lm.get("right_elbow", 14),
            lm.get("right_wrist", 16),
        ])

        if left_score >= right_score:
            indices = [
                lm.get("left_shoulder", 11),
                lm.get("left_elbow", 13),
                lm.get("left_wrist", 15),
            ]
        else:
            indices = [
                lm.get("right_shoulder", 12),
                lm.get("right_elbow", 14),
                lm.get("right_wrist", 16),
            ]

        if not self._use_2d_only and world_landmarks is not None:
            pts = [self._calc.get_landmark_xyz(world_landmarks, i) for i in indices]
            if all(p is not None for p in pts):
                return self._calc.calculate_angle(*pts)

        pts = [self._calc.get_landmark_xy(landmarks, i) for i in indices]
        return self._calc.calculate_angle(*pts)

    def _get_avg_visibility(self, landmarks, indices):
        vis = [landmarks[i][3] for i in indices if i < len(landmarks)]
        return sum(vis) / len(vis) if vis else 0.0

    def _make_result(self, rep_completed):
        return {
            "state": self._state,
            "rep_count": self._rep_count,
            "rep_completed": rep_completed,
            "in_rep": self._in_rep,
            "hip_velocity": [],
        }

    def reset(self):
        self._state = RepState.EXTENDED
        self._rep_count = 0
        self._hold_counter = 0
        self._stability_counter = 0
        self._in_rep = False
        self._reached_target = False
        self._smoother.reset()


def create_rep_detector(config, landmark_map=None):
    """Factory: create the appropriate rep detector based on state_machine type."""
    sm_type = config.get("state_machine", "descending_ascending")
    if sm_type == "contracting_extending":
        return CurlRepDetector(config, landmark_map or {})
    return SquatRepDetector(config, landmark_map or {})
