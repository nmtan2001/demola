import os
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    PoseLandmarker,
    PoseLandmarkerOptions,
    RunningMode,
    PoseLandmarksConnections,
)


class PoseExtractor:
    def __init__(self, model_complexity=1, min_detection_confidence=0.5,
                 min_tracking_confidence=0.5, model_dir="models"):
        # Map old complexity to model file names
        model_files = {
            0: "pose_landmarker_lite.task",
            1: "pose_landmarker_full.task",
            2: "pose_landmarker_heavy.task",
        }
        model_name = model_files.get(model_complexity, "pose_landmarker_full.task")
        model_path = os.path.join(model_dir, model_name)

        # Fall back to full model if requested one doesn't exist
        if not os.path.exists(model_path):
            model_path = os.path.join(model_dir, "pose_landmarker_full.task")

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model file not found: {model_path}. "
                f"Download from https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker"
            )

        options = PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model_path),
            running_mode=RunningMode.VIDEO,
            min_pose_detection_confidence=min_detection_confidence,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=min_tracking_confidence,
            num_poses=1,
            output_segmentation_masks=False,
        )
        self._landmarker = PoseLandmarker.create_from_options(options)
        self._timestamp_ms = 0

    def process(self, frame):
        """Extract pose landmarks from a BGR frame.

        Returns dict with 'landmarks' (33x4: x,y,z,visibility),
        'world_landmarks' (33x3 in meters), or None if no pose detected.
        """
        from mediapipe import Image

        # Convert BGR to RGB and create MediaPipe Image
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        self._timestamp_ms += 33  # ~30 FPS increment
        result = self._landmarker.detect_for_video(mp_image, self._timestamp_ms)

        if not result.pose_landmarks or len(result.pose_landmarks) == 0:
            return None

        # Extract first detected pose
        pose_lm = result.pose_landmarks[0]
        h, w = frame.shape[:2]
        landmarks = np.array([[lm.x * w, lm.y * h, lm.z * w, lm.visibility] for lm in pose_lm])

        world_landmarks = None
        if result.pose_world_landmarks and len(result.pose_world_landmarks) > 0:
            world_lm = result.pose_world_landmarks[0]
            world_landmarks = np.array([[lm.x, lm.y, lm.z] for lm in world_lm])

        return {
            "landmarks": landmarks,
            "world_landmarks": world_landmarks,
            "pose_landmarks_raw": pose_lm,
            "pose_world_landmarks_raw": (
                result.pose_world_landmarks[0]
                if result.pose_world_landmarks else None
            ),
        }

    def draw_landmarks(self, frame, pose_result, is_good_form=True):
        """Draw skeleton overlay on frame. Color depends on form quality."""
        if pose_result is None:
            return

        pose_lm = pose_result.get("pose_landmarks_raw")
        if pose_lm is None:
            return

        import cv2
        h, w = frame.shape[:2]

        # Choose colors based on form quality
        if is_good_form:
            line_color = (0, 255, 0)   # green
            dot_color = (0, 255, 0)    # green
        else:
            line_color = (0, 0, 255)   # red
            dot_color = (0, 165, 255)  # orange

        # Build pixel position list
        points = []
        for lm in pose_lm:
            px = int(lm.x * w)
            py = int(lm.y * h)
            points.append((px, py))

        # Draw connections
        connections = PoseLandmarksConnections.POSE_LANDMARKS
        for conn in connections:
            start_idx = conn[0] if isinstance(conn, (list, tuple)) else conn.start
            end_idx = conn[1] if isinstance(conn, (list, tuple)) else conn.end
            if start_idx < len(points) and end_idx < len(points):
                cv2.line(frame, points[start_idx], points[end_idx],
                         line_color, 2, cv2.LINE_AA)

        # Draw landmark points
        for px, py in points:
            cv2.circle(frame, (px, py), 3, dot_color, -1, cv2.LINE_AA)

    def release(self):
        self._landmarker.close()
