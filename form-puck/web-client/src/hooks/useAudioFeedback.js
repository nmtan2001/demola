import { useEffect, useRef, useCallback } from 'react';
import { EdgeTTS } from 'edge-tts-universal';

const speechQueue = [];
let isSpeaking = false;
let currentAudio = null;
let currentUtterance = null;

function processQueue() {
  if (isSpeaking || speechQueue.length === 0) return;
  isSpeaking = true;
  const { text, resolve } = speechQueue.shift();
  speakInternal(text).finally(() => {
    isSpeaking = false;
    processQueue();
    resolve();
  });
}

function cancelAll() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentUtterance && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
  speechQueue.length = 0;
}

async function speakInternal(text) {
  try {
    const tts = new EdgeTTS(text, 'en-US-EmmaMultilingualNeural');
    const result = await tts.synthesize();
    const audioUrl = URL.createObjectURL(result.audio);
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };
    await audio.play();
  } catch (error) {
    console.warn("Edge TTS failed, falling back to Web Speech API:", error);
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Microsoft') || v.name.includes('Google'));
    if (preferredVoice) utterance.voice = preferredVoice;
    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }
}

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
    if (!text) return;
    // Cancel current speech and clear queue so only the latest message plays
    cancelAll();
    return new Promise((resolve) => {
      speechQueue.push({ text, resolve });
      processQueue();
    });
  }, []);

  return { speak, isSupported };
};
