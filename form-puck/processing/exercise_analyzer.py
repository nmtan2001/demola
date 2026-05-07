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

        # Update rep state machine
        rep_info = self._rep_detector.update(landmarks)

        # Evaluate form (only meaningful during active movement)
        form_eval = self._form_scorer.evaluate(
            landmarks, world_landmarks, rep_info["state"], hip_velocity
        )

        # If rep completed, record the form score
        if rep_info["rep_completed"]:
            rep_info["form_score"] = form_eval["score"]
            rep_info["faults"] = form_eval["faults"]

        self._current_evaluation = form_eval

        return {
            "rep_info": rep_info,
            "form_eval": form_eval,
        }

    def reset(self):
        self._rep_detector.reset()
        self._current_evaluation = None

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
