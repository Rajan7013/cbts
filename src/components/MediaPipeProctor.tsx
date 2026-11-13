import { useEffect, useRef, useState } from 'react';
import { Camera, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

interface MediaPipeProctorProps {
  active: boolean;
  compact?: boolean;
  onStatusChange?: (status: { ready: boolean; faceCount: number; error?: string }) => void;
  onViolation?: (reason: string) => void;
}

export function MediaPipeProctor({
  active,
  compact = false,
  onStatusChange,
  onViolation,
}: MediaPipeProctorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const violationStartRef = useRef<number | null>(null);
  const lastFiredViolationRef = useRef<number>(0);

  const [faceCount, setFaceCount] = useState<number>(0);
  const [ready, setReady] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let rafId = 0;
    let lastDetectTime = 0;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        if (cancelled) return;

        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.55,
        });

        if (cancelled) {
          detector.close();
          return;
        }
        detectorRef.current = detector;
        setReady(true);
        onStatusChange?.({ ready: true, faceCount: 1 });

        const detectLoop = () => {
          if (cancelled) return;
          const now = performance.now();
          if (
            now - lastDetectTime >= 450 &&
            videoRef.current &&
            videoRef.current.readyState >= 2 &&
            detectorRef.current
          ) {
            lastDetectTime = now;
            try {
              const result = detectorRef.current.detectForVideo(videoRef.current, now);
              const count = result.detections?.length ?? 0;
              setFaceCount(count);
              onStatusChange?.({ ready: true, faceCount: count });

              if (count !== 1) {
                if (violationStartRef.current === null) {
                  violationStartRef.current = Date.now();
                } else if (Date.now() - violationStartRef.current >= 3500) {
                  if (Date.now() - lastFiredViolationRef.current >= 8000) {
                    lastFiredViolationRef.current = Date.now();
                    violationStartRef.current = null;
                    const reason =
                      count === 0
                        ? 'MediaPipe AI Proctor: No Face Visible (>3.5s)'
                        : `MediaPipe AI Proctor: ${count} Faces Detected in Frame`;
                    onViolation?.(reason);
                  }
                }
              } else {
                violationStartRef.current = null;
              }
            } catch {
              // Ignore transient frame read error
            }
          }
          rafId = requestAnimationFrame(detectLoop);
        };

        rafId = requestAnimationFrame(detectLoop);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Camera access denied or MediaPipe model unavailable.';
        setErrorMsg(msg);
        setReady(false);
        onStatusChange?.({ ready: false, faceCount: 0, error: msg });
      }
    }

    init();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (detectorRef.current) {
        detectorRef.current.close();
        detectorRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [active]);

  if (!active) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
        <div className="relative h-8 w-11 overflow-hidden rounded bg-slate-900 shrink-0">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover scale-x-[-1]"
          />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-white">
              <Camera className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
        <div className="text-xs leading-tight whitespace-nowrap">
          {errorMsg ? (
            <span className="font-medium text-amber-700 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Camera Off
            </span>
          ) : !ready ? (
            <span className="text-slate-500">Loading AI Proctor…</span>
          ) : faceCount === 1 ? (
            <span className="font-medium text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 1 Face Verified
            </span>
          ) : faceCount === 0 ? (
            <span className="font-medium text-red-700 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Face Missing
            </span>
          ) : (
            <span className="font-medium text-red-700 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {faceCount} Faces
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Camera className="h-4 w-4 text-blue-700" />
          <span>MediaPipe On-Device Face Verification</span>
        </div>
        {errorMsg ? (
          <span className="text-xs font-medium text-amber-700">Camera unavailable</span>
        ) : !ready ? (
          <span className="text-xs text-slate-500">Initializing BlazeFace model…</span>
        ) : faceCount === 1 ? (
          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> 1 Face Clearly Detected
          </span>
        ) : faceCount === 0 ? (
          <span className="text-xs font-semibold text-red-700 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> No Face in Frame
          </span>
        ) : (
          <span className="text-xs font-semibold text-red-700 flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {faceCount} Faces Detected (Only 1 Allowed)
          </span>
        )}
      </div>

      <div className="relative aspect-video w-full max-w-xs overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full object-cover scale-x-[-1]"
        />
        {errorMsg && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-xs text-slate-200 bg-slate-900/90">
            <AlertTriangle className="h-5 w-5 text-amber-400 mb-1.5" />
            <p>{errorMsg}</p>
            <p className="mt-1 text-slate-400">
              Fullscreen & tab-switch strike monitoring remains active.
            </p>
          </div>
        )}
      </div>
      <p className="mt-2.5 text-xs text-slate-500">
        Video stays 100% on-device in your browser via WebAssembly. No video frames are uploaded.
      </p>
    </div>
  );
}
