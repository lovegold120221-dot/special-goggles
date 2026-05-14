import { useState, useCallback } from 'react';
import {
  getVisionEngine,
  getClassColor,
  type DetectedObject,
  type DocumentAnalysis,
} from '../lib/vision';
import { Loader2, Search, FileText, X, Download, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageAnalyzerProps {
  imageDataUrl: string;
  fileName?: string;
  onClose: () => void;
  onResult?: (summary: string) => void;
}

type TabId = 'objects' | 'ocr' | 'layout';

export default function ImageAnalyzer({
  imageDataUrl,
  fileName,
  onClose,
  onResult,
}: ImageAnalyzerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('objects');
  const [objects, setObjects] = useState<DetectedObject[] | null>(null);
  const [docAnalysis, setDocAnalysis] = useState<DocumentAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });

  const runObjectDetection = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const engine = getVisionEngine();
      if (engine.status !== 'ready') {
        await engine.loadDetector();
      }
      const results = await engine.detectImage(imageDataUrl, 0.4);
      setObjects(results);
      if (onResult) {
        onResult(engine.summarizeDetections(results));
      }
    } catch (err: any) {
      setError(err.message || 'Detection failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageDataUrl, onResult]);

  const runOCR = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const engine = getVisionEngine();
      const result = await engine.analyzeDocument(imageDataUrl);
      setDocAnalysis(result);
      if (onResult && result.text.trim()) {
        const preview = result.text.slice(0, 300) + (result.text.length > 300 ? '...' : '');
        onResult(`OCR extracted: ${preview}`);
      }
    } catch (err: any) {
      setError(err.message || 'OCR failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageDataUrl, onResult]);

  const runLayout = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const engine = getVisionEngine();
      const result = await engine.analyzeDocumentLayout(imageDataUrl);
      setDocAnalysis({
        text: result.text,
        confidence: 0,
        blocks: result.paragraphs.map(p => ({
          text: p.text,
          bbox: p.bbox,
          confidence: 0,
        })),
      });
    } catch (err: any) {
      setError(err.message || 'Layout analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageDataUrl]);

  const switchTab = useCallback(
    (tab: TabId) => {
      setActiveTab(tab);
      setError(null);
      if (tab === 'objects' && !objects) runObjectDetection();
      else if (tab === 'ocr' && !docAnalysis) runOCR();
      else if (tab === 'layout' && !docAnalysis) runLayout();
    },
    [objects, docAnalysis, runObjectDetection, runOCR, runLayout],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[180] flex flex-col bg-[#0A0A0B]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          onClick={onClose}
          aria-label="Close image analysis"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {fileName || 'Image Analysis'}
          </p>
          <p className="text-[10px] text-zinc-500">YOLO Vision + OCR Engine</p>
        </div>
        <a
          href={imageDataUrl}
          download={fileName || 'analyzed-image.png'}
          className="flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-500"
        >
          <Download className="h-4 w-4" /> Save
        </a>
      </div>

      {/* Image preview with boxes */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <img
          src={imageDataUrl}
          alt={fileName || 'Analyzed image'}
          className="h-full w-full object-contain"
          onLoad={(e) => {
            setImageLoaded(true);
            const img = e.currentTarget;
            setImgDimensions({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />

        {/* Detection boxes overlay */}
        {activeTab === 'objects' && objects && imgDimensions.w > 0 && (
          <div className="pointer-events-none absolute inset-0">
            <svg
              viewBox={`0 0 ${imgDimensions.w} ${imgDimensions.h}`}
              className="h-full w-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {objects.map((det, i) => {
                const [nx, ny, nw, nh] = det.bbox;
                const x = nx * imgDimensions.w;
                const y = ny * imgDimensions.h;
                const w = nw * imgDimensions.w;
                const h = nh * imgDimensions.h;
                const color = getClassColor(det.class);

                return (
                  <g key={i}>
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={`${color}20`}
                      stroke={color}
                      strokeWidth="2"
                      rx="4"
                    />
                    <rect
                      x={x}
                      y={Math.max(0, y - 22)}
                      width={w}
                      height="22"
                      fill={`${color}CC`}
                      rx="4"
                    />
                    <text
                      x={x + 6}
                      y={Math.max(0, y - 8)}
                      fill="#000"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="system-ui"
                    >
                      {det.class} {Math.round(det.score * 100)}%
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {/* OCR block overlay */}
        {activeTab === 'ocr' && docAnalysis && imgDimensions.w > 0 && (
          <div className="pointer-events-none absolute inset-0">
            <svg
              viewBox={`0 0 ${imgDimensions.w} ${imgDimensions.h}`}
              className="h-full w-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {docAnalysis.blocks.map((block, i) => (
                <rect
                  key={i}
                  x={block.bbox.x0}
                  y={block.bbox.y0}
                  width={block.bbox.x1 - block.bbox.x0}
                  height={block.bbox.y1 - block.bbox.y0}
                  fill="rgba(190,242,100,0.12)"
                  stroke="rgba(190,242,100,0.5)"
                  strokeWidth="1.5"
                  rx="3"
                />
              ))}
            </svg>
          </div>
        )}

        {/* Loading overlay */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm"
            >
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-lime-300" />
              <p className="text-xs font-bold uppercase tracking-widest text-lime-200">
                Analyzing...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tab bar & results */}
      <div className="border-t border-white/10 bg-[#111113]">
        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { id: 'objects' as TabId, label: 'Objects', icon: Search },
            { id: 'ocr' as TabId, label: 'OCR Text', icon: FileText },
            { id: 'layout' as TabId, label: 'Layout', icon: FileText },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition ${
                activeTab === id
                  ? 'border-b-2 border-lime-300 text-lime-300'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Results panel */}
        <div className="max-h-52 overflow-y-auto p-4">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
              <button
                onClick={() => switchTab(activeTab)}
                className="ml-3 underline"
              >
                Retry
              </button>
            </div>
          )}

          {activeTab === 'objects' && objects && (
            <div>
              {objects.length === 0 ? (
                <p className="text-xs text-zinc-500">No objects detected in this image.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {objects.map((det, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: `${getClassColor(det.class)}20`,
                        color: getClassColor(det.class),
                        border: `1px solid ${getClassColor(det.class)}40`,
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: getClassColor(det.class) }}
                      />
                      {det.class} — {Math.round(det.score * 100)}%
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[10px] text-zinc-600">
                {objects.length} object{objects.length !== 1 ? 's' : ''} detected
                (min confidence: 40%)
              </p>
            </div>
          )}

          {activeTab === 'ocr' && docAnalysis && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Extracted Text ({(docAnalysis.confidence || 0).toFixed(0)}% avg confidence)
              </p>
              <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300">
                {docAnalysis.text.trim() || 'No text detected.'}
              </p>
              {docAnalysis.text.trim() && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(docAnalysis.text).catch(() => {});
                  }}
                  className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-400 hover:text-white"
                >
                  Copy Text
                </button>
              )}
            </div>
          )}

          {activeTab === 'layout' && docAnalysis && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Document Structure — {docAnalysis.blocks.length} block{docAnalysis.blocks.length !== 1 ? 's' : ''}
              </p>
              {docAnalysis.blocks.map((block, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-lime-300/70">
                    Block {i + 1}
                  </p>
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    {block.text || '(empty)'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!objects && !docAnalysis && !isAnalyzing && activeTab === 'objects' && (
            <button
              onClick={runObjectDetection}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-lime-300/30 bg-lime-300/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-lime-300 hover:bg-lime-300/20"
            >
              <Search className="h-4 w-4" /> Run Object Detection
            </button>
          )}
          {!docAnalysis && !isAnalyzing && activeTab === 'ocr' && (
            <button
              onClick={runOCR}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-blue-300 hover:bg-blue-400/20"
            >
              <FileText className="h-4 w-4" /> Run OCR
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
