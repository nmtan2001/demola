import cv2
import numpy as np


class SkeletonRenderer:
    def __init__(self):
        self._fault_joints = set()

    def set_fault_joints(self, faults, landmark_map):
        """Set which joints have faults for color coding."""
        self._fault_joints = set()
        for fault in faults:
            name = fault["name"]
            if name == "back_rounding":
                self._fault_joints.update([
                    landmark_map.get("left_shoulder", 11),
                    landmark_map.get("right_shoulder", 12),
                    landmark_map.get("left_hip", 23),
                    landmark_map.get("right_hip", 24),
                ])
            elif name == "insufficient_depth" or name == "knee_cave":
                self._fault_joints.update([
                    landmark_map.get("left_knee", 25),
                    landmark_map.get("right_knee", 26),
                    landmark_map.get("left_ankle", 27),
                    landmark_map.get("right_ankle", 28),
                ])
            elif name == "asymmetric_descent":
                self._fault_joints.update([
                    landmark_map.get("left_knee", 25),
                    landmark_map.get("right_knee", 26),
                ])

    def draw_fault_markers(self, frame, landmarks, faults, landmark_map):
        """Draw red fault markers on affected joints."""
        self.set_fault_joints(faults, landmark_map)
        if not self._fault_joints or landmarks is None:
            return

        h, w = frame.shape[:2]
        for idx in self._fault_joints:
            if idx < len(landmarks):
                x = int(landmarks[idx][0] * w)
                y = int(landmarks[idx][1] * h)
                cv2.circle(frame, (x, y), 8, (0, 0, 255), -1)
                cv2.circle(frame, (x, y), 10, (0, 0, 200), 2)

    def draw_angle_annotations(self, frame, landmarks, angles, landmark_map):
        """Draw angle values at joint locations."""
        if landmarks is None:
            return

        h, w = frame.shape[:2]

        angle_positions = {
            "knee_angle": landmark_map.get("left_knee", 25),
            "hip_angle": landmark_map.get("left_hip", 23),
            "back_angle": landmark_map.get("left_hip", 23),
        }

        for angle_name, lm_idx in angle_positions.items():
            value = angles.get(angle_name)
            if value is not None and lm_idx < len(landmarks):
                x = int(landmarks[lm_idx][0] * w)
                y = int(landmarks[lm_idx][1] * h)
                text = f"{value:.0f} deg"
                cv2.putText(frame, text, (x + 15, y - 15),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1,
                            cv2.LINE_AA)
