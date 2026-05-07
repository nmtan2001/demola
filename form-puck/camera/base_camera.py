from abc import ABC, abstractmethod


class BaseCamera(ABC):
    @abstractmethod
    def read(self):
        """Return (success: bool, frame: numpy.ndarray)."""
        pass

    @abstractmethod
    def release(self):
        """Release camera resources."""
        pass

    @abstractmethod
    def is_opened(self):
        """Return whether the camera is available."""
        pass

    @property
    @abstractmethod
    def width(self):
        pass

    @property
    @abstractmethod
    def height(self):
        pass
