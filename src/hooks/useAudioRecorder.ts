import { useState, useRef, useCallback } from "react";

interface UseAudioRecorderReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ transcript: string; durationSeconds: number } | null>;
  error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");
  const startTimeRef = useRef(0);

  const startRecording = useCallback(async () => {
    setError(null);
    transcriptRef.current = "";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      startTimeRef.current = Date.now();

      // Start live speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let text = "";
          for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              text += event.results[i][0].transcript + " ";
            }
          }
          transcriptRef.current = text.trim();
        };

        recognition.onerror = (event: any) => {
          if (event.error !== "no-speech" && event.error !== "aborted") {
            console.error("Speech recognition error:", event.error);
          }
        };

        // Auto-restart if it ends prematurely during recording
        recognition.onend = () => {
          if (mediaRecorderRef.current?.state === "recording") {
            try { recognition.start(); } catch {}
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } else {
        setError("Speech recognition not supported. Please use Chrome.");
      }

      setIsRecording(true);
    } catch (err) {
      setError("Microphone access denied. Please allow microphone access and try again.");
      console.error("Recording error:", err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    // Stop speech recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    // Stop media recorder
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    }

    setIsRecording(false);

    // Small delay to let final recognition results arrive
    await new Promise((r) => setTimeout(r, 500));

    return {
      transcript: transcriptRef.current,
      durationSeconds,
    };
  }, []);

  return { isRecording, startRecording, stopRecording, error };
}
