import enum
from collections import deque
import numpy as np
from processing.angle_calculator import AngleCalculator, EMASmoother


class RepState(enum.Enum):
    # Squat states
    STANDING = "STANDING"
    DESCENDING = "DESCENDING"
    BOTTOM = "BOTTOM"
    ASCENDING = "ASCENDING"
    # Curl states
    EXTENDED = "EXTENDED"
    CONTRACTING = "CONTRACTING"
    CONTRACTED = "CONTRACTED"
    EXTENDING = "EXTENDING"


class SquatRepDetector:
    """Rep detector for squat-type exercises using knee angle thresholds.

    Same approach as the working demo.html: picks the more visible side,
    computes knee angle (hip-knee-ankle), applies EMA smoothing, then
    drives a 4-state machine with angle thresholds.
    """

    # Thresholds matching demo.html
    STAND_MIN = 160
    DESCENT_START = 145
    BOTTOM_TARGET = 90

    def __init__(self, config):
        self._state = RepState.STANDING
        self._rep_count = 0
        self._smoother = EMASmoother(alpha=0.35)
        self._calc = AngleCalculator()
        self._in_rep = False
        self._reached_depth = False

    @property
    def state(self):
        return self._state

    @property
    def rep_count(self):
        return self._rep_count

    @property
    def in_rep(self):
        return self._in_rep

    def update(self, landmarks):
        if landmarks is None:
            return self._make_result(False)

        # Pick the more visible side (same as demo.html)
        knee_angle = self._get_knee_angle(landmarks)
        if knee_angle is None:
            return self._make_result(False)

        knee_angle = self._smoother.smooth("knee", knee_angle)
        rep_completed = False

        if self._state == RepState.STANDING:
            if knee_angle < self.DESCENT_START:
                self._state = RepState.DESCENDING
                self._in_rep = True
                self._reached_depth = False

        elif self._state == RepState.DESCENDING:
            if knee_angle < self.BOTTOM_TARGET:
                self._reached_depth = True
                self._state = RepState.BOTTOM
            elif knee_angle > self.STAND_MIN:
                self._state = RepState.STANDING
                self._in_rep = False

        elif self._state == RepState.BOTTOM:
            if knee_angle > self.BOTTOM_TARGET + 10:
                self._state = RepState.ASCENDING

        elif self._state == RepState.ASCENDING:
            if knee_angle > self.STAND_MIN:
                self._state = RepState.STANDING
                self._in_rep = False
                if self._reached_depth:
                    self._rep_count += 1
                    rep_completed = True
                self._reached_depth = False

        return self._make_result(rep_completed)

    def _get_knee_angle(self, landmarks):
        """Get knee angle from the more visible side."""
        left_vis = (landmarks[23][3] + landmarks[25][3] + landmarks[27][3]) / 3.0
        right_vis = (landmarks[24][3] + landmarks[26][3] + landmarks[28][3]) / 3.0

        if left_vis >= right_vis:
            hip = self._calc.get_landmark_xy(landmarks, 23)
            knee = self._calc.get_landmark_xy(landmarks, 25)
            ankle = self._calc.get_landmark_xy(landmarks, 27)
        else:
            hip = self._calc.get_landmark_xy(landmarks, 24)
            knee = self._calc.get_landmark_xy(landmarks, 26)
            ankle = self._calc.get_landmark_xy(landmarks, 28)

        return self._calc.calculate_angle(hip, knee, ankle)

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
        self._smoother.reset()


class CurlRepDetector:
    """Rep detector for curl-type exercises using elbow angle."""

    def __init__(self, config, landmark_map):
        self._state = RepState.EXTENDED
        self._rep_count = 0
        self._landmark_map = landmark_map
        self._calc = AngleCalculator()
        self._smoother = EMASmoother(alpha=0.35)
        self._extended_threshold = config.get("extended_threshold", 150)
        self._contracted_threshold = config.get("contracted_threshold", 55)
        self._transition_buffer = config.get("transition_buffer", 10)
        self._hold_frames = config.get("hold_frames", 3)
        self._hold_counter = 0
        self._stability_frames = config.get("standing_stability_frames", 5)
        self._stability_counter = 0
        self._in_rep = False
        self._reached_target = False

    @property
    def state(self):
        return self._state

    @property
    def rep_count(self):
        return self._rep_count

    @property
    def in_rep(self):
        return self._in_rep

    def update(self, landmarks):
        if landmarks is None:
            return self._make_result(False)

        elbow_angle = self._get_elbow_angle(landmarks)
        if elbow_angle is None:
            return self._make_result(False)

        elbow_angle = self._smoother.smooth("elbow", elbow_angle)
        rep_completed = False

        if self._state == RepState.EXTENDED:
            self._stability_counter += 1
            if elbow_angle < self._extended_threshold - self._transition_buffer:
                self._state = RepState.CONTRACTING
                self._in_rep = True
                self._reached_target = False
                self._stability_counter = 0

        elif self._state == RepState.CONTRACTING:
            if elbow_angle < self._contracted_threshold:
                self._reached_target = True
                self._state = RepState.CONTRACTED
                self._hold_counter = 0
            elif elbow_angle > self._extended_threshold:
                self._state = RepState.EXTENDED
                self._in_rep = False

        elif self._state == RepState.CONTRACTED:
            self._hold_counter += 1
            if elbow_angle > self._contracted_threshold + self._transition_buffer:
                self._state = RepState.EXTENDING

        elif self._state == RepState.EXTENDING:
            if elbow_angle > self._extended_threshold:
                self._stability_counter += 1
                if self._stability_counter >= self._stability_frames:
                    self._state = RepState.EXTENDED
                    self._rep_count += 1
                    self._in_rep = False
                    rep_completed = True
                    self._stability_counter = 0
            else:
                self._stability_counter = 0
                if elbow_angle < self._contracted_threshold:
                    self._state = RepState.CONTRACTED

        return self._make_result(rep_completed)

    def _get_elbow_angle(self, landmarks):
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
            pts = [
                self._calc.get_landmark_xy(landmarks, lm.get("left_shoulder", 11)),
                self._calc.get_landmark_xy(landmarks, lm.get("left_elbow", 13)),
                self._calc.get_landmark_xy(landmarks, lm.get("left_wrist", 15)),
            ]
        else:
            pts = [
                self._calc.get_landmark_xy(landmarks, lm.get("right_shoulder", 12)),
                self._calc.get_landmark_xy(landmarks, lm.get("right_elbow", 14)),
                self._calc.get_landmark_xy(landmarks, lm.get("right_wrist", 16)),
            ]

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
    return SquatRepDetector(config)
