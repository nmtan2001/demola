import { useEffect, useRef, useCallback, useState } from 'react';
import { EdgeTTS } from 'edge-tts-universal';

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

  const speak = useCallback(async (text) => {
    if (!text) return;

    try {
      // Attempt to use Edge TTS first (high quality, works natively in Edge browser)
      // Voice options: en-US-EmmaMultilingualNeural, en-US-GuyNeural, etc.
      const tts = new EdgeTTS(text, 'en-US-EmmaMultilingualNeural');
      const result = await tts.synthesize();
      
      const audioUrl = URL.createObjectURL(result.audio);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (error) {
      console.warn("Edge TTS failed (likely due to non-Edge browser restrictions). Falling back to Web Speech API:", error);
      
      if (!isSupported) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      // Try to find a Microsoft or high-quality voice in fallback
      const voices = window.speechSynthesis.getVoices();
      const msVoice = voices.find(v => v.name.includes('Microsoft') || v.name.includes('Google'));
      if (msVoice) {
        utterance.voice = msVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  }, [isSupported]);

  return { speak, isSupported };
};
