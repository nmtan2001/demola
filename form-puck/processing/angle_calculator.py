import numpy as np


class EMASmoother:
    """Exponential moving average smoother for angle values."""

    def __init__(self, alpha=0.35):
        self._alpha = alpha
        self._values = {}

    def smooth(self, key, value):
        if value is None:
            return None
        if key not in self._values or self._values[key] is None:
            self._values[key] = value
        else:
            self._values[key] = self._alpha * value + (1 - self._alpha) * self._values[key]
        return self._values[key]

    def reset(self):
        self._values = {}


class AngleCalculator:
    @staticmethod
    def calculate_angle(a, b, c):
        """Calculate angle at point b given three 2D/3D points.

        Args:
            a, b, c: numpy arrays of shape (2,) or (3,)
        Returns:
            Angle in degrees (0-180).
        """
        ba = a - b
        bc = c - b

        cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
        cosine = np.clip(cosine, -1.0, 1.0)
        return np.degrees(np.arccos(cosine))

    @staticmethod
    def calculate_vertical_angle(upper, lower):
        """Calculate forward lean angle relative to vertical using 3D points.

        Args:
            upper: shoulder point (x, y, z) in world coordinates
            lower: hip point (x, y, z) in world coordinates
        Returns:
            Angle from vertical in degrees. 0 = perfectly upright.
        """
        vec = np.array([upper[0] - lower[0], upper[1] - lower[1], upper[2] - lower[2]])
        vec_norm = np.linalg.norm(vec)
        if vec_norm < 1e-8:
            return 0.0
        vec = vec / vec_norm
        # Vertical direction in MediaPipe world coords: y-axis points downward
        vertical = np.array([0.0, 1.0, 0.0])
        cosine = np.dot(vertical, vec)
        cosine = np.clip(cosine, -1.0, 1.0)
        return np.degrees(np.arccos(cosine))

    @staticmethod
    def get_landmark_xy(landmarks, idx):
        """Extract x, y from landmark array (Nx4: x, y, z, visibility)."""
        return landmarks[idx, :2]

    @staticmethod
    def get_landmark_xyz(world_landmarks, idx):
        """Extract x, y, z from world landmark array (Nx3)."""
        if world_landmarks is None:
            return None
        return world_landmarks[idx, :3]

    @staticmethod
    def calculate_knee_cave(knee, ankle, foot_index):
        """Detect knee cave (valgus collapse) using 3D world coordinates.

        Measures lateral deviation of knee relative to ankle-foot centerline.

        Args:
            knee: knee point (x, y, z) in world coordinates
            ankle: ankle point (x, y, z)
            foot_index: foot index (toe) point (x, y, z)
        Returns:
            Lateral deviation angle in degrees. 0 = perfect alignment.
        """
        foot_center_x = (ankle[0] + foot_index[0]) / 2.0
        lateral_deviation = knee[0] - foot_center_x
        vertical_dist = abs(knee[1] - ankle[1])
        if vertical_dist < 1e-6:
            return 0.0
        angle = np.degrees(np.arctan(abs(lateral_deviation) / vertical_dist))
        return angle
