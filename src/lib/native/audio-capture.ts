// Native Android audio yozish — WebView'ning getUserMedia/MediaRecorder
// "Could not start audio source" muammosini chetlab o'tadi. JS shu wrapper
// orqali Java MediaRecorder'ni boshqaradi, audio'ni base64 sifatida oladi
// va Whisper API'ga jo'natadi.

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface AudioCapturePlugin {
  startRecording(): Promise<{ started: boolean; path: string }>;
  stopRecording(): Promise<{
    audioBase64: string;
    mimeType: string;
    durationMs: number;
    byteLength: number;
  }>;
  cancelRecording(): Promise<{ cancelled: boolean }>;
  isRecording(): Promise<{ recording: boolean }>;
}

const noop: AudioCapturePlugin = {
  startRecording: async () => ({ started: false, path: "" }),
  stopRecording: async () => ({
    audioBase64: "",
    mimeType: "audio/mp4",
    durationMs: 0,
    byteLength: 0,
  }),
  cancelRecording: async () => ({ cancelled: false }),
  isRecording: async () => ({ recording: false }),
};

export const AudioCapture: AudioCapturePlugin = Capacitor.isNativePlatform()
  ? registerPlugin<AudioCapturePlugin>("AudioCapture")
  : noop;

export const AUDIO_CAPTURE_AVAILABLE = Capacitor.isNativePlatform();

// Base64 → Blob — Whisper API'ga jo'natish uchun
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
