import json
import os
from processing.pose_extractor import PoseExtractor
from processing.rep_detector import create_rep_detector
from processing.form_scorer import FormScorer


class ExerciseAnalyzer:
    def __init__(self, exercise_name, exercises_dir="config/exercises"):
        config_path = os.path.join(exercises_dir, f"{exercise_name}.json")
        with open(config_path, "r") as f:
            self._config = json.load(f)

        self._name = self._config["name"]
        self._landmark_map = self._config["landmarks"]
        self._rep_detector = create_rep_detector(
            self._config["rep_detection"], self._landmark_map
        )
        self._form_scorer = FormScorer(self._config)
        self._current_evaluation = None
        self._rep_faults_accumulated = {}
        self._rep_scores = []

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

        # Evaluate form (only meaningful during active movement)
        form_eval = self._form_scorer.evaluate(
            landmarks, world_landmarks, rep_info["state"], hip_velocity
        )

        # Reset accumulators on new rep start
        if not was_in_rep and self._rep_detector.in_rep:
            self._rep_faults_accumulated = {}
            self._rep_scores = []

        # Accumulate faults and scores while actively in a rep
        if self._rep_detector.in_rep:
            self._rep_scores.append(form_eval["score"])
            for fault in form_eval["faults"]:
                name = fault["name"]
                if name not in self._rep_faults_accumulated:
                    self._rep_faults_accumulated[name] = fault
                else:
                    if fault["value"] is not None:
                        prev_val = self._rep_faults_accumulated[name]["value"]
                        # Store the maximum (worst) deviation value
                        if prev_val is None or fault["value"] > prev_val:
                            self._rep_faults_accumulated[name]["value"] = fault["value"]

        # If rep completed, record the accumulated form score and faults
        if rep_info["rep_completed"]:
            final_score = min(self._rep_scores) if self._rep_scores else form_eval["score"]
            final_faults = list(self._rep_faults_accumulated.values())

            rep_info["form_score"] = final_score
            rep_info["faults"] = final_faults

            # Override the current frame's evaluation for reporting
            form_eval["score"] = final_score
            form_eval["faults"] = final_faults
            form_eval["is_good"] = len(final_faults) == 0

            # Clear accumulators for the next rep
            self._rep_faults_accumulated = {}
            self._rep_scores = []

        self._current_evaluation = form_eval

        return {
            "rep_info": rep_info,
            "form_eval": form_eval,
        }

    def reset(self):
        self._rep_detector.reset()
        self._current_evaluation = None
        self._rep_faults_accumulated = {}
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
