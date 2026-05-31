import json
import os
from processing.pose_extractor import PoseExtractor
from processing.rep_detector import create_rep_detector
from processing.form_scorer import FormScorer


class ExerciseAnalyzer:
    def __init__(self, exercise_name, exercises_dir="config/exercises", fps=30):
        config_path = os.path.join(exercises_dir, f"{exercise_name}.json")
        with open(config_path, "r") as f:
            self._config = json.load(f)

        self._id = exercise_name
        self._name = self._config["name"]
        self._landmark_map = self._config["landmarks"]
        self._rep_detector = create_rep_detector(
            self._config["rep_detection"], self._landmark_map, fps=fps
        )
        self._form_scorer = FormScorer(self._config)
        self._current_evaluation = None
        self._rep_faults_accumulated = {}
        self._rep_fault_absent_frames = {}
        self._rep_scores = []

    @property
    def exercise_id(self):
        return self._id

    @property
    def name(self):
        return self._name

    @property
    def rep_count(self):
        return self._rep_detector.rep_count

    @property
    def state(self):
        return self._rep_detector.state

    @property
    def current_evaluation(self):
        return self._current_evaluation

    def analyze(self, landmarks, world_landmarks, hip_velocity=None):
        """Run full analysis pipeline on one frame.

        Returns dict with rep_info, form_eval.
        """
        if hip_velocity is None:
            hip_velocity = []

        was_in_rep = self._rep_detector.in_rep

        # Update rep state machine
        rep_info = self._rep_detector.update(landmarks, world_landmarks)

        # Reset accumulators on new rep start — BEFORE evaluate() so that the first
        # frame of the new rep is scored with clean hysteresis, not stale state from
        # the previous rep.
        if not was_in_rep and self._rep_detector.in_rep:
            self._rep_faults_accumulated = {}
            self._rep_fault_absent_frames = {}
            self._rep_scores = []
            self._form_scorer.clear_rep()

        # When pose is unavailable, skip evaluation entirely.  The rep-timeout
        # path inside rep_detector.update() already handles stuck states on dropout;
        # returning the last known eval avoids score flickering to 100 and avoids
        # calling form_scorer with None which would leave _active_faults stale.
        if landmarks is None:
            form_eval = self._current_evaluation if self._current_evaluation is not None else {
                "score": 100, "faults": [], "angles": {}, "is_good": True
            }
            self._current_evaluation = form_eval
            return {"rep_info": rep_info, "form_eval": form_eval}

        # Evaluate form (only meaningful during active movement)
        form_eval = self._form_scorer.evaluate(
            landmarks, world_landmarks, rep_info["state"], hip_velocity
        )

        # Accumulate faults and scores while actively in a rep.
        # Guard both score and fault operations on landmarks presence so that a
        # tracking dropout (landmarks=None → empty fault list) cannot silently
        # erase faults that were correctly detected earlier in the rep.
        if self._rep_detector.in_rep and landmarks is not None:
            self._rep_scores.append(form_eval["score"])

            current_fault_names = {fault["name"] for fault in form_eval["faults"]}

            # Add or update worst-value for any currently active fault
            for fault in form_eval["faults"]:
                name = fault["name"]
                if name not in self._rep_faults_accumulated:
                    self._rep_faults_accumulated[name] = fault
                else:
                    if fault["value"] is not None:
                        prev_val = self._rep_faults_accumulated[name]["value"]
                        direction = fault.get("direction", "above")
                        # Store the worst deviation, respecting fault direction
                        if direction == "below":
                            if prev_val is None or fault["value"] < prev_val:
                                self._rep_faults_accumulated[name]["value"] = fault["value"]
                        else:
                            if prev_val is None or fault["value"] > prev_val:
                                self._rep_faults_accumulated[name]["value"] = fault["value"]

            # Remove faults that have been continuously absent for at least 3 consecutive
            # frames so that a fault active for most of the rep is not erased by a
            # single good frame.  The 3-frame threshold is short enough to reflect a
            # genuine correction while guarding against momentary tracking noise.
            for name in list(self._rep_faults_accumulated.keys()):
                if name not in current_fault_names:
                    self._rep_fault_absent_frames[name] = (
                        self._rep_fault_absent_frames.get(name, 0) + 1
                    )
                    if self._rep_fault_absent_frames[name] >= 3:
                        del self._rep_faults_accumulated[name]
                        self._rep_fault_absent_frames.pop(name, None)
                else:
                    # Fault is still active — reset its absence counter
                    self._rep_fault_absent_frames.pop(name, None)

        # If rep completed, derive score directly from the final retained faults so
        # that the score is always consistent with what is shown in the fault list.
        # Faults that fired transiently and were later cleared do not affect the
        # final score even though they may have affected per-frame averages.
        if rep_info["rep_completed"]:
            base_score = self._form_scorer._scoring_config.get("base_score", 100)
            final_faults = list(self._rep_faults_accumulated.values())
            final_score = max(0, base_score - sum(f["deduction"] for f in final_faults))
            final_score = round(float(final_score), 1)

            rep_info["form_score"] = final_score
            rep_info["faults"] = final_faults

            # Override the current frame's evaluation for reporting
            form_eval["score"] = final_score
            form_eval["faults"] = final_faults
            form_eval["is_good"] = len(final_faults) == 0

            # Clear accumulators for the next rep
            self._rep_faults_accumulated = {}
            self._rep_fault_absent_frames = {}
            self._rep_scores = []

        self._current_evaluation = form_eval

        return {
            "rep_info": rep_info,
            "form_eval": form_eval,
        }

    def reset(self):
        self._rep_detector.reset()
        self._form_scorer.reset()
        self._current_evaluation = None
        self._rep_faults_accumulated = {}
        self._rep_fault_absent_frames = {}
        self._rep_scores = []

    @staticmethod
    def list_available_exercises(exercises_dir="config/exercises"):
        """List all available exercise configs."""
        exercises = []
        if os.path.isdir(exercises_dir):
            for f in os.listdir(exercises_dir):
                if f.endswith(".json"):
                    with open(os.path.join(exercises_dir, f), "r") as fp:
                        cfg = json.load(fp)
                        exercises.append({
                            "id": f.replace(".json", ""),
                            "name": cfg.get("name", f.replace(".json", "")),
                        })
        return exercises
