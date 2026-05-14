// KIE API Integration for Image/Video Generation, File Upload, and Account Management

const KIE_GENERATION_BASE = 'https://api.kie.ai';
const KIE_FILE_BASE = 'https://kieai.redpandaai.co';
const KIE_COMMON_BASE = 'https://api.kie.ai';

// ============ IMAGE & VIDEO GENERATION ============

export async function kieGenerateImage(
  apiKey: string,
  request: {
    model?: string;
    prompt: string;
    num_steps?: number;
    guidance_scale?: number;
    seed?: number;
  }
): Promise<{ taskId: string }> {
  // Try v1/tasks/image first, fall back to other endpoints
  const endpoints = [
    'https://api.kie.ai/v1/tasks/image',
    'https://api.kie.ai/api/v1/tasks/image',
    'https://api.kie.ai/tasks/image',
  ];

  let lastError = new Error('All KIE endpoints failed');
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        const result = await response.json();
        return { taskId: result.task_id };
      }

      const errorData = await response.json().catch(() => ({ msg: `HTTP ${response.status}` }));
      lastError = new Error(errorData.msg || `HTTP ${response.status}`);
    } catch (e) {
      lastError = e as Error;
    }
  }

  throw lastError;
}

export async function kieGenerateVideo(
  apiKey: string,
  request: {
    model?: string;
    prompt: string;
    duration?: number;
    fps?: number;
    resolution?: string;
  }
): Promise<{ taskId: string }> {
  const endpoints = [
    'https://api.kie.ai/v1/tasks/video',
    'https://api.kie.ai/api/v1/tasks/video',
    'https://api.kie.ai/tasks/video',
  ];

  let lastError = new Error('All KIE endpoints failed');
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        const result = await response.json();
        return { taskId: result.task_id };
      }

      const errorData = await response.json().catch(() => ({ msg: `HTTP ${response.status}` }));
      lastError = new Error(errorData.msg || `HTTP ${response.status}`);
    } catch (e) {
      lastError = e as Error;
    }
  }

  throw lastError;
}

export async function kieQueryTask(apiKey: string, taskId: string): Promise<any> {
  const endpoints = [
    `https://api.kie.ai/v1/tasks/${taskId}`,
    `https://api.kie.ai/api/v1/tasks/${taskId}`,
    `https://api.kie.ai/tasks/${taskId}`,
  ];

  let lastError = new Error('All KIE query endpoints failed');
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return response.json();
      }

      const errorData = await response.json().catch(() => ({ msg: `HTTP ${response.status}` }));
      lastError = new Error(errorData.msg || `HTTP ${response.status}`);
    } catch (e) {
      lastError = e as Error;
    }
  }

  throw lastError;
}

export async function pollKieTask(
  apiKey: string,
  taskId: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await kieQueryTask(apiKey, taskId);

    if (result.status === 'completed') {
      return result.result;
    }

    if (result.status === 'failed') {
      throw new Error(result.error || 'Something went wrong with that task.');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('That task is taking longer than expected.');
}

// ============ FILE UPLOAD ============

export async function kieUploadFromUrl(
  apiKey: string,
  fileUrl: string,
  uploadPath = '',
  fileName?: string
): Promise<any> {
  const response = await fetch(`${KIE_FILE_BASE}/api/file-url-upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileUrl,
      uploadPath,
      fileName,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ msg: "That upload didn't go through." }));
    throw new Error(error.msg || "That upload didn't go through.");
  }

  return response.json();
}

export async function kieUploadBase64(
  apiKey: string,
  base64Data: string,
  uploadPath = '',
  fileName?: string
): Promise<any> {
  const response = await fetch(`${KIE_FILE_BASE}/api/file-base64-upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base64Data,
      uploadPath,
      fileName,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ msg: "That upload didn't go through." }));
    throw new Error(error.msg || "That upload didn't go through.");
  }

  return response.json();
}

export async function kieUploadStream(
  apiKey: string,
  file: File | Blob,
  uploadPath = '',
  fileName?: string
): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  if (uploadPath) formData.append('uploadPath', uploadPath);
  if (fileName) formData.append('fileName', fileName);

  const response = await fetch(`${KIE_FILE_BASE}/api/file-stream-upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ msg: "That upload didn't go through." }));
    throw new Error(error.msg || "That upload didn't go through.");
  }

  return response.json();
}

// ============ COMMON API ============

export async function kieGetCredits(apiKey: string): Promise<number> {
  const response = await fetch(`${KIE_COMMON_BASE}/chat/credit`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ msg: "Couldn't check the balance right now." }));
    throw new Error(error.msg || "Couldn't check the balance right now.");
  }

  const result = await response.json();
  return result.data;
}

export async function kieGetDownloadUrl(apiKey: string, fileUrl: string): Promise<string> {
  const response = await fetch(`${KIE_COMMON_BASE}/common/download-url`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: fileUrl }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ msg: "Couldn't get the download link." }));
    throw new Error(error.msg || "Couldn't get the download link.");
  }

  const result = await response.json();
  return result.data;
}

// ============ HELPERS ============

export function imageToBase64(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("That image didn't process properly."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    img.onerror = () => reject(new Error("Couldn't load that image."));
    img.src = uri;
  });
}

export function videoFrameToBase64(videoUri: string, timeSeconds = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;

    const cleanup = () => {
      video.src = '';
      video.load();
    };

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(timeSeconds, video.duration || 0);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cleanup();
        reject(new Error("That video didn't process properly."));
        return;
      }
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const base64 = dataUrl.split(',')[1];
      cleanup();
      resolve(base64);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Couldn't load that video."));
    };

    video.src = videoUri;
  });
}

export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}