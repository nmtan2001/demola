import threading
import numpy as np

try:
    import pygame
    PYGAME_AVAILABLE = True
except ImportError:
    PYGAME_AVAILABLE = False


class AudioFeedback:
    def __init__(self):
        self._initialized = False
        if PYGAME_AVAILABLE:
            try:
                pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=512)
                self._initialized = True
                self._rep_sound = self._generate_tone(880, 0.1, 0.3)
                self._fault_sound = self._generate_tone(220, 0.15, 0.5)
            except pygame.error:
                self._initialized = False

    def _generate_tone(self, frequency, duration, volume):
        """Generate a simple sine wave tone."""
        sample_rate = 44100
        n_samples = int(sample_rate * duration)
        t = np.linspace(0, duration, n_samples, endpoint=False)
        wave = np.sin(2 * np.pi * frequency * t)
        wave = (wave * volume * 32767).astype(np.int16)
        # Stereo: duplicate mono signal to both channels
        wave = np.column_stack((wave, wave))
        sound = pygame.sndarray.make_sound(wave)
        return sound

    def play_rep_complete(self):
        if self._initialized:
            threading.Thread(target=self._rep_sound.play, daemon=True).start()

    def play_fault(self):
        if self._initialized:
            threading.Thread(target=self._fault_sound.play, daemon=True).start()

    def release(self):
        if self._initialized:
            pygame.mixer.quit()
