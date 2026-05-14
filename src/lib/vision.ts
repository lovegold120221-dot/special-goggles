import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { createWorker, type Worker } from 'tesseract.js';

// --- TYPES ---

export interface DetectedObject {
  bbox: [number, number, number, number]; // [x, y, width, height] normalized 0-1
  class: string;
  score: number;
}

export interface DocumentAnalysis {
  text: string;
  confidence: number;
  blocks: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    confidence: number;
  }>;
}

export type DetectorStatus = 'idle' | 'loading' | 'ready' | 'error';

// --- YOLO-STYLE OBJECT DETECTION ENGINE (COCO-SSD MobileNet) ---

export class VisionEngine {
  private model: cocoSsd.ObjectDetection | null = null;
  private tesseractWorker: Worker | null = null;
  private _status: DetectorStatus = 'idle';
  private _loadProgress = 0;

  get status() { return this._status; }
  get loadProgress() { return this._loadProgress; }

  /** Load the COCO-SSD lite model (80-class YOLO-style detection) */
  async loadDetector(): Promise<void> {
    if (this.model) return;
    this._status = 'loading';
    this._loadProgress = 0;

    try {
      await tf.ready();
      this._loadProgress = 30;
      this.model = await cocoSsd.load({
        base: 'mobilenet_v2',
        modelUrl: undefined,
      });
      this._loadProgress = 100;
      this._status = 'ready';
    } catch (err) {
      this._status = 'error';
      this._loadProgress = 0;
      throw err;
    }
  }

  /** Detect objects in a video/image element */
  async detect(
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    maxResults = 20,
    threshold = 0.45,
  ): Promise<DetectedObject[]> {
    if (!this.model || this._status !== 'ready') {
      throw new Error('Detector not loaded. Call loadDetector() first.');
    }

    const predictions = await this.model.detect(source, maxResults, threshold);

    return predictions
      .filter(p => p.score >= threshold)
      .map(p => ({
        bbox: [
          p.bbox[0] / (source instanceof HTMLVideoElement ? source.videoWidth : source.width || 1),
          p.bbox[1] / (source instanceof HTMLVideoElement ? source.videoHeight : source.height || 1),
          p.bbox[2] / (source instanceof HTMLVideoElement ? source.videoWidth : source.width || 1),
          p.bbox[3] / (source instanceof HTMLVideoElement ? source.videoHeight : source.height || 1),
        ] as [number, number, number, number],
        class: p.class,
        score: p.score,
      }));
  }

  /** Detect objects in a raw image data URL / blob */
  async detectImage(dataUrl: string, threshold = 0.45): Promise<DetectedObject[]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const results = await this.detect(img, 30, threshold);
          resolve(results);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image for detection'));
      img.src = dataUrl;
    });
  }

  // --- OCR / DOCUMENT ANALYSIS ---

  /** Load Tesseract OCR worker */
  async loadOCR(language = 'eng'): Promise<void> {
    if (this.tesseractWorker) return;
    this.tesseractWorker = await createWorker(language);
  }

  /** Extract text from a document image using OCR */
  async analyzeDocument(dataUrl: string): Promise<DocumentAnalysis> {
    if (!this.tesseractWorker) {
      await this.loadOCR();
    }

    const result = await this.tesseractWorker!.recognize(dataUrl);

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      blocks: (result.data.blocks || []).map(block => ({
        text: block.text,
        bbox: block.bbox,
        confidence: block.confidence,
      })),
    };
  }

  /** Get text with layout info (lines, paragraphs, words) for structured docs */
  async analyzeDocumentLayout(dataUrl: string): Promise<{
    text: string;
    paragraphs: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>;
    lines: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>;
    words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>;
  }> {
    if (!this.tesseractWorker) {
      await this.loadOCR();
    }

    const result = await this.tesseractWorker!.recognize(dataUrl);

    return {
      text: result.data.text,
      paragraphs: (result.data.paragraphs || []).map(p => ({
        text: p.text,
        bbox: p.bbox,
      })),
      lines: (result.data.lines || []).map(l => ({
        text: l.text,
        bbox: l.bbox,
      })),
      words: (result.data.words || []).map(w => ({
        text: w.text,
        bbox: w.bbox,
      })),
    };
  }

  /** Check if a document appears to be a form (has labels + input areas) */
  isFormDocument(doc: DocumentAnalysis): boolean {
    const text = doc.text.toLowerCase();
    const formKeywords = ['name:', 'date:', 'signature:', 'address:', 'phone:', 'email:', '□', 'check', 'form', 'application'];
    return formKeywords.some(kw => text.includes(kw));
  }

  /** Summarize detected objects into a readable string */
  summarizeDetections(detections: DetectedObject[]): string {
    if (detections.length === 0) return 'No objects detected.';

    const high = detections.filter(d => d.score >= 0.7);
    const medium = detections.filter(d => d.score >= 0.5 && d.score < 0.7);

    const parts: string[] = [];
    if (high.length > 0) {
      parts.push(`High confidence: ${high.map(d => `${d.class} (${Math.round(d.score * 100)}%)`).join(', ')}`);
    }
    if (medium.length > 0) {
      parts.push(`Medium confidence: ${medium.map(d => `${d.class} (${Math.round(d.score * 100)}%)`).join(', ')}`);
    }
    return parts.join(' | ');
  }

  /** Clean up resources */
  dispose(): void {
    if (this.tesseractWorker) {
      this.tesseractWorker.terminate();
      this.tesseractWorker = null;
    }
    this.model = null;
    this._status = 'idle';
    this._loadProgress = 0;
  }
}

// --- SINGLETON ---

let _visionEngine: VisionEngine | null = null;

export function getVisionEngine(): VisionEngine {
  if (!_visionEngine) {
    _visionEngine = new VisionEngine();
  }
  return _visionEngine;
}

// --- COLOR MAP FOR VISUALIZATION ---

const CLASS_COLORS: Record<string, string> = {
  person: '#FF6B6B',
  car: '#4ECDC4',
  truck: '#45B7D1',
  bicycle: '#96CEB4',
  motorcycle: '#FFEAA7',
  bus: '#DDA0DD',
  train: '#98D8C8',
  airplane: '#F7DC6F',
  boat: '#BB8FCE',
  bird: '#85C1E9',
  cat: '#F8C471',
  dog: '#82E0AA',
  horse: '#F1948A',
  sheep: '#73C6B6',
  cow: '#D7BDE2',
  elephant: '#A3E4D7',
  bear: '#FAD7A0',
  zebra: '#ABEBC6',
  giraffe: '#AED6F1',
  backpack: '#D5F5E3',
  umbrella: '#FADBD8',
  handbag: '#D6EAF8',
  tie: '#FCF3CF',
  suitcase: '#D1F2EB',
  frisbee: '#F6DDCC',
  skis: '#D4E6F1',
  snowboard: '#E8DAEF',
  sports_ball: '#F9E79F',
  kite: '#A2D9CE',
  baseball_bat: '#F5CBA7',
  baseball_glove: '#D2B4DE',
  skateboard: '#A9CCE3',
  surfboard: '#F0B27A',
  tennis_racket: '#D5DBDF',
  bottle: '#AED6F1',
  wine_glass: '#F1948A',
  cup: '#D5F5E3',
  fork: '#FCF3CF',
  knife: '#FADBD8',
  spoon: '#E8DAEF',
  bowl: '#D1F2EB',
  banana: '#F9E79F',
  apple: '#F5CBA7',
  orange: '#FAD7A0',
  broccoli: '#ABEBC6',
  carrot: '#F1948A',
  hot_dog: '#D7BDE2',
  pizza: '#F8C471',
  donut: '#DDA0DD',
  cake: '#FFEAA7',
  chair: '#A2D9CE',
  couch: '#D6EAF8',
  potted_plant: '#82E0AA',
  bed: '#D5DBDF',
  dining_table: '#F6DDCC',
  toilet: '#D4E6F1',
  tv: '#FCF3CF',
  laptop: '#85C1E9',
  mouse: '#D1F2EB',
  remote: '#F0B27A',
  keyboard: '#AED6F1',
  cell_phone: '#98D8C8',
  microwave: '#BB8FCE',
  oven: '#FF6B6B',
  toaster: '#96CEB4',
  sink: '#45B7D1',
  refrigerator: '#4ECDC4',
  book: '#F7DC6F',
  clock: '#DDA0DD',
  vase: '#A3E4D7',
  scissors: '#FADBD8',
  teddy_bear: '#D2B4DE',
  hair_drier: '#F9E79F',
  toothbrush: '#73C6B6',
};

const DEFAULT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

let _colorIdx = 0;

export function getClassColor(className: string): string {
  if (CLASS_COLORS[className]) return CLASS_COLORS[className];
  const color = DEFAULT_COLORS[_colorIdx % DEFAULT_COLORS.length];
  _colorIdx++;
  CLASS_COLORS[className] = color;
  return color;
}
