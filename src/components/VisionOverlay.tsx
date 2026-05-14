import { useEffect, useRef, useState, useCallback } from 'react';
import {
  getVisionEngine,
  getClassColor,
  type DetectedObject,
  type DetectorStatus,
} from '../lib/vision';
import { Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VisionOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  onToggle: () => void;
  detectionInterval?: number; // ms between detections
  threshold?: number; // confidence threshold
  maxDetections?: number; // max objects to show
}

export default function VisionOverlay({
  videoRef,
  enabled,
  onToggle,
  detectionInterval = 800,
  threshold = 0.45,
  maxDetections = 15,
}: VisionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [status, setStatus] = useState<DetectorStatus>('idle');
  const [loadProgress, setLoadProgress] = useState(0);
  const [fps, setFps] = useState(0);
  const rafRef = useRef<number>(0);
  const lastDetectionRef = useRef(0);
  const frameCountRef = useRef(0);
  const fpsTimerRef = useRef(0);

  // Load detector when enabled
  useEffect(() => {
    if (!enabled) {
      setDetections([]);
      return;
    }

    let cancelled = false;
    const engine = getVisionEngine();

    const load = async () => {
      if (engine.status === 'ready') {
        setStatus('ready');
        setLoadProgress(100);
        return;
      }

      try {
        setStatus('loading');
        await engine.loadDetector();
        if (!cancelled) {
          setStatus('ready');
          setLoadProgress(100);
        }
      } catch (err) {
        console.error('Vision engine load failed:', err);
        if (!cancelled) {
          setStatus('error');
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [enabled]);

  // Detection loop using requestAnimationFrame
  useEffect(() => {
    if (!enabled || status !== 'ready') return;

    const engine = getVisionEngine();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    fpsTimerRef.current = performance.now();

    const loop = async (now: number) => {
      if (!enabled) return;

      const elapsed = now - lastDetectionRef.current;

      // Draw the current video frame to canvas for display
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        // FPS tracking
        frameCountRef.current++;
        if (now - fpsTimerRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          fpsTimerRef.current = now;
        }
      }

      // Run detection at the specified interval
      if (elapsed >= detectionInterval) {
        try {
          const results = await engine.detect(video, maxDetections, threshold);
          setDetections(results);
        } catch {
          // silent - frame may be empty
        }
        lastDetectionRef.current = now;
      }

      // Draw bounding boxes
      drawBoxes(ctx, canvas, detections, video);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled, status, videoRef, detectionInterval, threshold, maxDetections, detections]);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-3xl">
      {/* Detection canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      />

      {/* Status bar */}
      <AnimatePresence>
        {enabled && detections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5"
          >
            {detections.slice(0, 5).map((d, i) => (
              <span
                key={`${d.class}-${i}`}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-md"
                style={{
                  backgroundColor: `${getClassColor(d.class)}40`,
                  color: getClassColor(d.class),
                  border: `1px solid ${getClassColor(d.class)}60`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: getClassColor(d.class) }}
                />
                {d.class} {Math.round(d.score * 100)}%
              </span>
            ))}
            {detections.length > 5 && (
              <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold text-zinc-400 backdrop-blur-md">
                +{detections.length - 5}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay */}
      <AnimatePresence>
        {status === 'loading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-lime-300" />
            <p className="text-xs font-bold uppercase tracking-widest text-lime-200">
              Loading YOLO Vision Engine
            </p>
            <div className="mt-3 h-1 w-32 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-lime-300"
                animate={{ width: `${loadProgress}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      <AnimatePresence>
        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <AlertTriangle className="mb-2 h-6 w-6 text-red-400" />
            <p className="text-xs text-red-300">Vision engine failed to load</p>
            <button
              onClick={() => {
                getVisionEngine().dispose();
                getVisionEngine().loadDetector().then(() => setStatus('ready')).catch(() => setStatus('error'));
              }}
              className="mt-3 rounded-full bg-red-500/20 px-4 py-1.5 text-[10px] font-bold uppercase text-red-300"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FPS counter */}
      {enabled && status === 'ready' && fps > 0 && (
        <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-mono text-zinc-400 backdrop-blur-md">
          {fps} FPS
        </div>
      )}
    </div>
  );
}

// --- Canvas drawing helpers ---

function drawBoxes(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  detections: DetectedObject[],
  video: HTMLVideoElement,
) {
  if (video.videoWidth === 0) return;

  const scaleX = canvas.width / video.videoWidth;
  const scaleY = canvas.height / video.videoHeight;

  for (const det of detections) {
    const [nx, ny, nw, nh] = det.bbox;
    const x = nx * video.videoWidth * scaleX;
    const y = ny * video.videoHeight * scaleY;
    const w = nw * video.videoWidth * scaleX;
    const h = nh * video.videoHeight * scaleY;

    const color = getClassColor(det.class);

    // Box fill
    ctx.fillStyle = `${color}18`;
    ctx.fillRect(x, y, w, h);

    // Box border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Label background
    const label = `${det.class} ${Math.round(det.score * 100)}%`;
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    const metrics = ctx.measureText(label);
    const labelW = metrics.width + 10;
    const labelH = 20;

    // Draw label above the box
    let labelY = y - labelH - 2;
    if (labelY < 0) labelY = y + h + 2; // below if not enough space

    ctx.fillStyle = `${color}CC`;
    ctx.fillRect(x, labelY, labelW, labelH);

    ctx.fillStyle = '#000';
    ctx.fillText(label, x + 5, labelY + 14);
  }
}
