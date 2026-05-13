import threading
import time
import numpy as np

try:
    import pygame
    PYGAME_AVAILABLE = True
except ImportError:
    PYGAME_AVAILABLE = False

try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False


FAULT_PHRASES = {
    "back_rounding": "Chest up",
    "insufficient_depth": "Go deeper",
    "knee_cave": "Knees out",
    "asymmetric_descent": "Stay balanced",
    "bounce_at_bottom": "Control the bottom",
    "elbow_swing": "Keep elbows tucked",
    "insufficient_contraction": "Full range",
    "bar_path_deviation": "Keep bar close",
    "hip_shoot": "Drive together",
}

VOICE_COOLDOWN = 5.0  # seconds before repeating the same fault phrase


class AudioFeedback:
    def __init__(self):
        self._initialized = False
        self._voice_enabled = True
        self._speaking = False
        self._last_spoken = {}  # fault_name -> timestamp

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

    @property
    def voice_enabled(self):
        return self._voice_enabled

    @voice_enabled.setter
    def voice_enabled(self, value):
        self._voice_enabled = bool(value)

    def play_rep_complete(self):
        if self._initialized:
            threading.Thread(target=self._rep_sound.play, daemon=True).start()

    def play_fault(self):
        if self._initialized:
            threading.Thread(target=self._fault_sound.play, daemon=True).start()

    def speak_fault(self, fault_name):
        """Speak a fault phrase if voice is enabled and cooldown has passed."""
        if not self._voice_enabled or not PYTTSX3_AVAILABLE:
            return
        phrase = FAULT_PHRASES.get(fault_name)
        if not phrase:
            return

        now = time.time()
        last = self._last_spoken.get(fault_name, 0)
        if now - last < VOICE_COOLDOWN:
            return
        if self._speaking:
            return

        self._last_spoken[fault_name] = now
        threading.Thread(target=self._speak, args=(phrase,), daemon=True).start()

    def speak_rep_complete(self):
        """Speak a short rep confirmation."""
        if not self._voice_enabled or not PYTTSX3_AVAILABLE:
            return
        if self._speaking:
            return
        threading.Thread(target=self._speak, args=("Rep",), daemon=True).start()

    def _speak(self, text):
        """Internal: run pyttsx3 say+runAndWait in this thread."""
        self._speaking = True
        try:
            engine = pyttsx3.init()
            engine.setProperty("rate", 180)
            engine.say(text)
            engine.runAndWait()
            engine.stop()
        except Exception:
            pass
        finally:
            self._speaking = False

    def release(self):
        if self._initialized:
            pygame.mixer.quit()
