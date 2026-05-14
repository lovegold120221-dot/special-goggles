// HeyGen Video Agent API Integration

const HEYGEN_BASE = 'https://api.heygen.com/v1';

// ============ VIDEO AGENT GENERATION ============

export interface HeyGenVideoAgentRequest {
  prompt: string;
  avatar_id?: string;
  voice_id?: string;
  style_id?: string;
  orientation?: 'landscape' | 'portrait';
  files?: Array<{ type: 'url'; url: string } | { type: 'asset_id'; asset_id: string } | { type: 'base64'; media_type: string; data: string }>;
  callback_url?: string;
  callback_id?: string;
}

export interface HeyGenVideoAgentResponse {
  session_id: string;
  status: 'thinking' | 'generating' | 'completed' | 'failed';
  video_id: string | null;
  created_at: number;
}

export interface HeyGenVideoStatus {
  id: string;
  title: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url: string | null;
  thumbnail_url: string | null;
  gif_url: string | null;
  captioned_video_url: string | null;
  subtitle_url: string | null;
  duration: number | null;
  created_at: number | null;
  completed_at: number | null;
  failure_code: string | null;
  failure_message: string | null;
  video_page_url: string | null;
}

export async function heygenCreateVideoAgent(
  apiKey: string,
  request: HeyGenVideoAgentRequest
): Promise<HeyGenVideoAgentResponse> {
  const response = await fetch(`${HEYGEN_BASE}/video-agents`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "That video creation didn't go through." }));
    throw new Error(error.message || "That video creation didn't go through.");
  }

  const result = await response.json();
  return result.data;
}

export async function heygenPollSession(
  apiKey: string,
  sessionId: string
): Promise<{
  session_id: string;
  status: 'thinking' | 'generating' | 'completed' | 'failed';
  video_id: string | null;
  created_at: number;
}> {
  const response = await fetch(`${HEYGEN_BASE}/video-agents/${sessionId}`, {
    method: 'GET',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Couldn't check the video status." }));
    throw new Error(error.message || "Couldn't check the video status.");
  }

  const result = await response.json();
  return result.data;
}

export async function heygenPollVideo(
  apiKey: string,
  videoId: string
): Promise<HeyGenVideoStatus> {
  const response = await fetch(`${HEYGEN_BASE}/videos/${videoId}`, {
    method: 'GET',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Couldn't check the video status." }));
    throw new Error(error.message || "Couldn't check the video status.");
  }

  const result = await response.json();
  return result.data;
}

export async function pollHeygenVideoAgent(
  apiKey: string,
  sessionId: string,
  maxAttempts = 120,
  intervalMs = 5000
): Promise<HeyGenVideoStatus> {
  let videoId: string | null = null;

  // First, poll until we get a video_id
  for (let i = 0; i < maxAttempts; i++) {
    const session = await heygenPollSession(apiKey, sessionId);

    if (session.status === 'failed') {
      throw new Error('That video generation ran into a problem.');
    }

    if (session.video_id) {
      videoId = session.video_id;
      break;
    }

    if (session.status === 'completed' && !session.video_id) {
      throw new Error('The video finished but something went wrong with the result.');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  if (!videoId) {
    throw new Error('That video is taking longer than expected.');
  }

  // Now poll the video until completion
  for (let i = 0; i < maxAttempts; i++) {
    const video = await heygenPollVideo(apiKey, videoId);

    if (video.status === 'completed') {
      return video;
    }

    if (video.status === 'failed') {
      throw new Error(video.failure_message || 'Video generation failed');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timeout waiting for video completion');
}

export async function heygenListVideos(
  apiKey: string,
  limit = 10,
  token?: string
): Promise<{ data: HeyGenVideoStatus[]; next_token?: string }> {
  let url = `${HEYGEN_BASE}/videos?limit=${limit}`;
  if (token) url += `&token=${token}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Couldn't load the video list." }));
    throw new Error(error.message || "Couldn't load the video list.");
  }

  return response.json();
}

export async function heygenDeleteVideo(
  apiKey: string,
  videoId: string
): Promise<{ id: string; deleted: boolean }> {
  const response = await fetch(`${HEYGEN_BASE}/videos/${videoId}`, {
    method: 'DELETE',
    headers: {
      'X-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Couldn't delete that video." }));
    throw new Error(error.message || "Couldn't delete that video.");
  }

  const result = await response.json();
  return result.data;
}