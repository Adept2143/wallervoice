import { useState, useRef, useCallback } from "react";
import { detectPitch, getRMS } from "@/lib/acousticAnalyzer";

interface AcousticRaw {
  pitchHistory: number[];
  volumeHistory: number[];
  silenceFrames: number;
}

interface RecordingResult {
  transcript: string;
  durationSeconds: number;
  audioUrl: string;
  acousticRaw: AcousticRaw;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingResult | null>;
  error: string | null;
}

export function useAudioRecorder(lang: string = "en-US"): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");
  const startTimeRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Acoustic analysis refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pitchHistoryRef = useRef<number[]>([]);
  const volumeHistoryRef = useRef<number[]>([]);
  const silenceFramesRef = useRef(0);
  const frameCountRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    transcriptRef.current = "";
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Reset acoustic collections
      pitchHistoryRef.current = [];
      volumeHistoryRef.current = [];
      silenceFramesRef.current = 0;
      frameCountRef.current = 0;

      // Web Audio analysis
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      // Analysis loop
      const loop = () => {
        if (!analyserRef.current) return;
        rafRef.current = requestAnimationFrame(loop);
        frameCountRef.current++;
        if (frameCountRef.current % 4 !== 0) return;

        const buf = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buf);
        const pitch = detectPitch(buf.slice(), audioCtx.sampleRate);
        const rms = getRMS(buf);

        if (pitch > 80 && pitch < 400) pitchHistoryRef.current.push(pitch);
        volumeHistoryRef.current.push(rms);
        if (rms < 0.008) silenceFramesRef.current++;
      };
      loop();

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000);
      startTimeRef.current = Date.now();

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = lang;

        recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              transcriptRef.current += event.results[i][0].transcript + " ";
            }
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error !== "no-speech" && event.error !== "aborted") {
            console.error("Speech recognition error:", event.error);
          }
        };

        recognition.onend = () => {
          if (mediaRecorderRef.current?.state === "recording") {
            try {
              recognition.start();
            } catch {}
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } else {
        console.warn("Speech recognition not supported in this browser.");
      }

      setIsRecording(true);
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Microphone access denied. Please allow microphone access in your browser settings and try again.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone and try again.");
      } else {
        setError("Could not start recording. Please check your microphone and try again.");
      }
      console.error("Recording error:", err);
    }
  }, [lang]);

  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    // Stop analysis loop
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    const mediaRecorder = mediaRecorderRef.current;
    let audioUrl = "";

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
      });

      if (chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        audioUrl = URL.createObjectURL(blob);
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setIsRecording(false);

    // Poll until acoustic data is collected or max 3s
    const pollStart = Date.now();
    await new Promise<void>((resolve) => {
      const check = () => {
        const hasData = pitchHistoryRef.current.length > 0 || volumeHistoryRef.current.length > 0;
        if (hasData || Date.now() - pollStart >= 3000) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });

    return {
      transcript: transcriptRef.current.trim(),
      durationSeconds,
      audioUrl,
      acousticRaw: {
        pitchHistory: [...pitchHistoryRef.current],
        volumeHistory: [...volumeHistoryRef.current],
        silenceFrames: silenceFramesRef.current,
      },
    };
  }, []);

  return { isRecording, startRecording, stopRecording, error };
}
