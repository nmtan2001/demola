import { useEffect, useRef, useCallback } from 'react';

export const useAudioFeedback = () => {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const voicesRef = useRef([]);

  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [isSupported]);

  const speak = useCallback((text) => {
    if (!isSupported) return;

    // Optional: could cancel if we want immediate feedback, but for reps it's better to queue
    // window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  return { speak, isSupported };
};
