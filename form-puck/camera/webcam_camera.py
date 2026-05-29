import cv2
from camera.base_camera import BaseCamera


class WebcamCamera(BaseCamera):
    def __init__(self, camera_index=0, width=640, height=480, fps=30):
        self._width = width
        self._height = height
        self._cap = cv2.VideoCapture(camera_index)
        if self._cap.isOpened():
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
            self._cap.set(cv2.CAP_PROP_FPS, fps)
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    def read(self):
        if not self._cap.isOpened():
            return False, None
        return self._cap.read()

    def release(self):
        if self._cap.isOpened():
            self._cap.release()

    def is_opened(self):
        return self._cap.isOpened()

    @property
    def width(self):
        return self._width

    @property
    def height(self):
        return self._height
