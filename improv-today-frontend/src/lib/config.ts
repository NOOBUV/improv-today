// Centralized configuration
export const config = {
  // API configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
    timeout: 30000, // 30 seconds
  },
  
  // Local speech-to-text: mic -> browser VAD -> the local voice server that already does TTS.
  // Off (NEXT_PUBLIC_LOCAL_STT=false) means Chrome's Web Speech API, which sends the audio to
  // Google and guesses at end-of-speech with speech.interimSilenceTimeout below.
  localStt: {
    enabled: process.env.NEXT_PUBLIC_LOCAL_STT !== 'false',
    serverUrl: 'http://localhost:8880', // same sidecar as TTS — see lib/speech.ts
    healthTimeout: 1500, // ms; a dev-machine sidecar answers in single digits or it's down
  },

  // Speech recognition configuration (Chrome Web Speech fallback path)
  speech: {
    silenceTimeout: 1200, // ms after a final result before sending
    // Chrome sometimes stops emitting results after the user goes quiet without ever
    // marking one final. Watchdog: finalize the interim text after this much silence.
    interimSilenceTimeout: 1800, // ms of no new results while listening
    language: 'en-US',
    interimResults: true,
    continuous: false,
  },
  
  // AI speech configuration
  aiSpeech: {
    autoStartListeningDelay: 500, // ms after AI finishes speaking
    preferredVoice: 'Google UK English Female',
    fallbackVoices: [
      'Samantha',
      'Alex',
      'Google US English',
    ],
  },
  
  // Session configuration
  session: {
    defaultPersonality: 'friendly' as const,
    updateInterval: 1000, // ms for session duration updates
  },
  
  
  // UI configuration
  ui: {
    notificationDuration: 3000, // ms
    loadingStates: true,
  },
  
  // Environment flags
  env: {
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },
} as const;

export type Config = typeof config;