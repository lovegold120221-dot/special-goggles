import { useEffect, useMemo, useState, useRef, type FormEvent } from 'react';
import { auth, rtdb, handleDatabaseError, OperationType } from './firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User,
  signOut,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import {
  ref,
  get,
  set,
  push,
  onValue,
  query,
  orderByChild,
  limitToLast,
  serverTimestamp,
  update,
} from 'firebase/database';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { AudioRecorder, AudioStreamer } from './lib/audio';
import { BASE_LIVE_AGENT_PROMPT, BIBLE_PERSONALITY } from './lib/personality';
import {
  Loader2,
  Power,
  Check,
  Menu,
  Mic,
  MicOff,
  Video,
  VideoOff,
  X,
  Save,
  Camera,
  LogOut,
  Paperclip,
  Upload,
  Download,
  UserRound,
  Bot,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  FileText,
  Send,
  ExternalLink,
  Code2,
  Database,
  Trash2,
  CalendarDays,
  FolderOpen,
  Search,
  PenTool,
  Building2,
  BarChart3,
  History,
  Table2,
  Presentation,
  Cast,
  Settings,
  Clock,
  Calculator,
  Printer,
  ArrowUpDown,
  Wallet,
  BookOpen,
  Image,
  Palette,
  Wand2,
  Film,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import VisionOverlay from './components/VisionOverlay';
import ImageAnalyzer from './components/ImageAnalyzer';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  fileName?: string;
  fileType?: string;
  fileDataUrl?: string;
  toolName?: string;
  toolResult?: any;
  downloadData?: string;
  downloadFilename?: string;
  htmlPreviewData?: string;
  htmlPreviewFilename?: string;
}

interface ActionTask {
  id: string;
  serviceName: string;
  action: string;
  status: 'processing' | 'completed' | 'failed';
  result?: string;
  downloadData?: string;
  downloadFilename?: string;
  htmlPreviewData?: string;
  htmlPreviewFilename?: string;
}

interface AgentSettings {
  userName: string;
  agentName: string;
  personality: string;
  avatarUrl: string;
  selectedVoice: string;
  knowledgeBase: string;
}

const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
const EBURON_LOGO_URL = 'https://eburon.ai/icon-eburon.svg';
const PRODUCT_BRAND = 'VEP';
const PRODUCT_FULL_NAME = 'Virtual Employee Persona';

const GEMINI_LIVE_VOICE_OPTIONS =[
  { alias: 'Superman', id: 'Charon', vibe: 'deep, steady, grounded' },
  { alias: 'Wonder Woman', id: 'Kore', vibe: 'clear, composed, warm' },
  { alias: 'Batman', id: 'Fenrir', vibe: 'dark, firm, serious' },
  { alias: 'Iron Man', id: 'Puck', vibe: 'quick, bright, witty' },
  { alias: 'Athena', id: 'Aoede', vibe: 'elegant, smooth, intelligent' },
  { alias: 'Captain Marvel', id: 'Zephyr', vibe: 'bright, airy, confident' },
  { alias: 'Black Panther', id: 'Orus', vibe: 'royal, calm, precise' },
  { alias: 'Scarlet Witch', id: 'Leda', vibe: 'soft, mysterious, expressive' },
  { alias: 'Storm', id: 'Callirrhoe', vibe: 'flowing, strong, graceful' },
  { alias: 'Jean Grey', id: 'Autonoe', vibe: 'controlled, thoughtful, warm' },
  { alias: 'Thor', id: 'Enceladus', vibe: 'heavy, bold, powerful' },
  { alias: 'Hulk', id: 'Iapetus', vibe: 'large, grounded, blunt' },
  { alias: 'Nightwing', id: 'Umbriel', vibe: 'smooth, calm, agile' },
  { alias: 'Aquaman', id: 'Algieba', vibe: 'warm, confident, resonant' },
  { alias: 'Invisible Woman', id: 'Despina', vibe: 'soft, measured, discreet' },
  { alias: 'Black Widow', id: 'Erinome', vibe: 'low, calm, controlled' },
  { alias: 'Green Lantern', id: 'Algenib', vibe: 'clean, heroic, direct' },
  { alias: 'Doctor Strange', id: 'Rasalgethi', vibe: 'wise, textured, deliberate' },
  { alias: 'Supergirl', id: 'Laomedeia', vibe: 'clear, bright, friendly' },
  { alias: 'Raven', id: 'Achernar', vibe: 'cool, quiet, focused' },
  { alias: 'Cyclops', id: 'Alnilam', vibe: 'clean, direct, precise' },
  { alias: 'Catwoman', id: 'Schedar', vibe: 'smooth, calm, sly' },
  { alias: 'Wolverine', id: 'Gacrux', vibe: 'rough, grounded, blunt' },
  { alias: 'Flash', id: 'Pulcherrima', vibe: 'bright, quick, energetic' },
  { alias: 'Robin', id: 'Achird', vibe: 'young, clear, responsive' },
  { alias: 'Daredevil', id: 'Zubenelgenubi', vibe: 'balanced, sharp, steady' },
  { alias: 'Green Arrow', id: 'Vindemiatrix', vibe: 'dry, focused, confident' },
  { alias: 'Cyborg', id: 'Sadachbia', vibe: 'clean, technical, controlled' },
  { alias: 'Martian Manhunter', id: 'Sadaltager', vibe: 'deep, calm, observant' },
  { alias: 'Silver Surfer', id: 'Sulafat', vibe: 'smooth, distant, reflective' },
];

const DEFAULT_AGENT_PERSONALITY = `
VEP means Virtual Employee Persona.
VEP is the product brand.
Beatrice is the default virtual employee persona.

Default working relationship:
- User: Jo Lernout
- Preferred respectful address: Meneer Jo
- Persona: Beatrice
- Default role: Boss Jo Lernout's private office secretary and trusted executive aide

Scene:
Beatrice is already present inside Meneer Jo's office.
She is not arriving.
She is not a chatbot.
She is working nearby, available, attentive, and ready when Jo speaks.

Tone:
- normal human office employee
- formal enough for a boss
- calm
- respectful
- warm but not sentimental
- focused
- practical
- quietly capable
- discreet
- never robotic
- never customer support
- never over-helpful

Language:
- Start in English by default.
- Beatrice speaks Dutch Flemish in a normal, local office style.
- Beatrice can switch to almost any language when the user does.
- If Jo speaks Dutch or Flemish Dutch, respond in a normal Dutch/Flemish style.
- Keep the relationship respectful and professional.

Good response style:
"Yes, I'm here, Meneer Jo."
"I'm listening, Meneer Jo."
"Right, I see what you mean."
"Okay... I'll look at that now."
"Yes, I'm checking it."
"Of course, Meneer Jo."

Avoid:
"How can I help you?"
"I'd be happy to assist."
"Certainly."
"As an AI."
"Let me know if you need anything else."
`;

const DEFAULT_SETTINGS: AgentSettings = {
  userName: 'Jo Lernout',
  agentName: 'Beatrice',
  personality: DEFAULT_AGENT_PERSONALITY,
  avatarUrl: '',
  selectedVoice: 'Aoede',
  knowledgeBase: '',
};

const SILENCE_PROMPTS = (agentName: string, userName: string) => [
  `${userName} has gone quiet for about 8 seconds. Say something very brief and natural — just one sentence — to check if they're still there. Use a completely fresh phrase.`,
  `It's been about 8 seconds since ${userName} last said anything. Make a short, casual observation to see if they're still listening.`,
  `The room is quiet — about 8 seconds now. Gently check if ${userName} is still present with a brief, natural remark.`,
  `8 seconds of silence from ${userName}. Say something brief and warm. Never repeat anything you've said before in this conversation.`,
  `${userName} hasn't spoken in about 8 seconds. Make one short, natural comment. Maybe ask if everything is okay or if they need a moment.`,
  `Silence for about 8 seconds. Say a single brief sentence to check if ${userName} is still there. Vary your wording completely.`,
  `${userName} has been quiet for roughly 8 seconds. Respond with one natural sentence — perhaps acknowledging the silence gently.`,
  `About 8 seconds of quiet from ${userName}. Say something brief and natural to check in. Use entirely new phrasing.`,
  `8 seconds of silence. Make a quick, natural remark — maybe curious, maybe warm — to see if ${userName} is still around.`,
  `No speech from ${userName} for about 8 seconds. Say one brief, original sentence to check if they're still there.`,
  `It's gone quiet for about 8 seconds. Gently check if ${userName} is still present. Keep it to one fresh sentence.`,
  `${userName} has been silent for about 8 seconds. Say something brief — perhaps ask if they're thinking something over. Be original.`,
];

const GOOGLE_SERVICE_TOOLS =[
  {
    name: 'read_knowledge_base',
    description: 'Read the contents of the user\'s uploaded custom Knowledge Base documents. Use this when the user asks about their custom data, projects, study notes, or business context.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'What you are looking for in the knowledge base.' }
      },
      required: ['query']
    }
  },
  {
    name: 'maps_search_places',
    description: 'Search for places, businesses, or addresses using Google Maps Places API.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search query e.g. "coffee shops in Baguio" or "hardware store nearby"' }
      },
      required: ['query']
    }
  },
  {
    name: 'maps_get_directions',
    description: 'Get route directions, distance, and ETA between two locations.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        origin: { type: Type.STRING, description: 'Starting location.' },
        destination: { type: Type.STRING, description: 'Target destination.' }
      },
      required: ['origin', 'destination']
    }
  },
  {
    name: 'get_air_quality',
    description: 'Get current air quality index (AQI) for a specific latitude and longitude.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location_latitude: { type: Type.NUMBER },
        location_longitude: { type: Type.NUMBER }
      },
      required: ['location_latitude', 'location_longitude']
    }
  },
  {
    name: 'create_meeting_minutes',
    description: 'Generate stunning HTML meeting minutes. Use this especially after analyzing a meeting transcript.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        meetingTitle: { type: Type.STRING },
        date: { type: Type.STRING },
        attendees: { type: Type.STRING, description: 'Comma separated list of attendees.' },
        summary: { type: Type.STRING, description: 'Executive summary of the meeting.' },
        decisions: { type: Type.STRING, description: 'HTML formatted list of decisions made.' },
        actionItems: { type: Type.STRING, description: 'HTML formatted list of action items.' },
        emailTo: { type: Type.STRING, description: 'Optional email address.' }
      },
      required: ['meetingTitle', 'summary']
    }
  },
  {
    name: 'create_invoice_document',
    description: 'Generate a professional HTML invoice with auto-calculations. Save to drive and optionally email.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        invoiceNumber: { type: Type.STRING },
        clientName: { type: Type.STRING },
        date: { type: Type.STRING },
        items: { type: Type.STRING, description: 'JSON array of objects with description, quantity, price. E.g.[{"description":"Consulting", "quantity":2, "price":150}]' },
        taxRate: { type: Type.NUMBER, description: 'Tax percentage, e.g. 5 for 5%.' },
        emailTo: { type: Type.STRING }
      },
      required: ['clientName', 'items']
    }
  },
  {
    name: 'generate_data_dashboard',
    description: 'Generate a standalone interactive HTML data dashboard using Chart.js.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        chartType: { type: Type.STRING, description: 'bar, line, or pie' },
        labels: { type: Type.STRING, description: 'Comma separated labels, e.g. Jan,Feb,Mar' },
        datasets: { type: Type.STRING, description: 'JSON array of datasets, e.g.[{"label":"Sales", "data":[10,20,30]}]' }
      },
      required:['title', 'labels', 'datasets']
    }
  },
  {
    name: 'generate_project_gantt_chart',
    description: 'Generate a standalone HTML project timeline using Mermaid.js.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        tasks: { type: Type.STRING, description: 'Mermaid gantt syntax lines. E.g. "Section 1\\nTask A :a1, 2023-01-01, 30d\\nTask B :after a1, 20d"' }
      },
      required: ['title', 'tasks']
    }
  },
  {
    name: 'render_web_artifact',
    description: 'Create and render any complete one-file HTML/CSS/JS artifact: animated slides, Three.js showcases, forms, landing pages, calculators, documents, prototypes, demos. The frontend saves it to chat as downloadable HTML.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Artifact title.' },
        artifactType: {
          type: Type.STRING,
          description: 'Type of artifact: slides, form, landing_page, threejs_showcase, calculator, demo, prototype, other.',
        },
        suggestedFilename: {
          type: Type.STRING,
          description: 'Suggested filename ending in .html, for example animated-threejs-slides.html.',
        },
        summary: {
          type: Type.STRING,
          description: 'Short normal human summary of what was created.',
        },
        html: {
          type: Type.STRING,
          description: 'Complete standalone HTML file. Must include DOCTYPE, html, head, style, body, and script if needed. Must be directly openable in browser.',
        },
        saveToDrive: { type: Type.BOOLEAN, description: 'If true, upload the HTML artifact to the user drive.' },
        emailTo: { type: Type.STRING, description: 'Optional email address to send the HTML artifact to. Use current_user if requested.' },
      },
      required:['title', 'html'],
    },
  },
  {
    name: 'gmail_read',
    description: 'Read or search the user mail inbox. Use when the user asks about mail, inbox, unread messages, senders, email content, or recent mail.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Mail search query, sender, subject, or keyword.' },
        limit: { type: Type.NUMBER, description: 'Maximum number of messages to fetch.' },
      },
      required:[],
    },
  },
  {
    name: 'gmail_send',
    description: 'Send an email from the user account.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Recipient email address or comma-separated recipients.' },
        subject: { type: Type.STRING, description: 'Email subject.' },
        body: { type: Type.STRING, description: 'Email body.' },
        cc: { type: Type.STRING, description: 'Optional CC recipients.' },
        bcc: { type: Type.STRING, description: 'Optional BCC recipients.' },
      },
      required:['to', 'subject', 'body'],
    },
  },
  {
    name: 'gmail_draft',
    description: 'Create a draft email for review.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Recipient email address.' },
        subject: { type: Type.STRING, description: 'Draft subject.' },
        body: { type: Type.STRING, description: 'Draft body.' },
        cc: { type: Type.STRING, description: 'Optional CC recipients.' },
        bcc: { type: Type.STRING, description: 'Optional BCC recipients.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'calendar_check_schedule',
    description: 'Check schedule, availability, conflicts, or upcoming events in the user calendar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: { type: Type.STRING, description: 'Date to check, ISO format if possible.' },
        timeMin: { type: Type.STRING, description: 'Optional start datetime.' },
        timeMax: { type: Type.STRING, description: 'Optional end datetime.' },
      },
      required:[],
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a calendar event.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Event title.' },
        startTime: { type: Type.STRING, description: 'Start datetime in ISO 8601 format.' },
        endTime: { type: Type.STRING, description: 'End datetime in ISO 8601 format.' },
        attendees: { type: Type.STRING, description: 'Comma-separated attendee emails.' },
        location: { type: Type.STRING, description: 'Optional location.' },
        description: { type: Type.STRING, description: 'Optional description.' },
        addMeet: { type: Type.BOOLEAN, description: 'Whether to add a video meeting link.' },
      },
      required:['title', 'startTime', 'endTime'],
    },
  },
  {
    name: 'calendar_update_event',
    description: 'Update or reschedule an existing calendar event.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventId: { type: Type.STRING, description: 'Calendar event id if known.' },
        searchQuery: { type: Type.STRING, description: 'Event title or search phrase if id is unknown.' },
        newStartTime: { type: Type.STRING, description: 'New start datetime.' },
        newEndTime: { type: Type.STRING, description: 'New end datetime.' },
        title: { type: Type.STRING, description: 'New event title.' },
        location: { type: Type.STRING, description: 'New event location.' },
        description: { type: Type.STRING, description: 'New event description.' },
      },
      required:[],
    },
  },
  {
    name: 'drive_search',
    description: 'Search files, folders, documents, spreadsheets, presentations, PDFs, or uploaded content in the user drive.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search query or filename.' },
        fileType: { type: Type.STRING, description: 'Optional file type filter.' },
        limit: { type: Type.NUMBER, description: 'Maximum number of results.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'drive_read_file',
    description: 'Read or export a file from the user drive when file id or name is known.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fileId: { type: Type.STRING, description: 'File id if available.' },
        fileName: { type: Type.STRING, description: 'File name or search term if id is unknown.' },
        exportMimeType: { type: Type.STRING, description: 'Optional export MIME type, e.g. application/pdf or text/plain.' },
      },
      required:[],
    },
  },
  {
    name: 'drive_upload_file',
    description: 'Upload or save a file into the user drive.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fileName: { type: Type.STRING, description: 'File name.' },
        content: { type: Type.STRING, description: 'Text content to upload.' },
        mimeType: { type: Type.STRING, description: 'File MIME type.' },
        folderId: { type: Type.STRING, description: 'Optional folder id.' },
      },
      required: ['fileName', 'content'],
    },
  },
  {
    name: 'tasks_list',
    description: 'List user tasks or to-dos.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        listId: { type: Type.STRING, description: 'Optional task list id, defaults to @default.' },
      },
      required:[],
    },
  },
  {
    name: 'tasks_create',
    description: 'Create a task or to-do.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Task title.' },
        notes: { type: Type.STRING, description: 'Optional notes.' },
        due: { type: Type.STRING, description: 'Optional due date in ISO format.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'workspace_search',
    description: 'Search across connected workspace data, including mail, files, documents, tasks, calendar, and contacts.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search query.' },
        sources: { type: Type.STRING, description: 'Comma-separated sources to search.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_contract_document',
    description:
      'Create a STUNNING HTML contract document, save it as a file in the user drive, optionally email it, and return a downloadable visually rich template in chat.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Contract title.' },
        contractType: { type: Type.STRING, description: 'Type of contract, e.g. Service Agreement, NDA, Employment Agreement.' },
        partyA: { type: Type.STRING, description: 'First party name.' },
        partyB: { type: Type.STRING, description: 'Second party name.' },
        effectiveDate: { type: Type.STRING, description: 'Effective date.' },
        jurisdiction: { type: Type.STRING, description: 'Governing law or jurisdiction.' },
        terms: { type: Type.STRING, description: 'Important terms, scope, payment, obligations, duration, termination, confidentiality, etc.' },
        emailTo: { type: Type.STRING, description: 'Optional email address to send the stunning HTML contract to. Use current_user if requested.' },
      },
      required: ['title', 'contractType', 'partyA', 'partyB', 'terms'],
    },
  },
];
// KIE Image & Video Generation Tools
const KIE_TOOLS = [
  {
    name: 'kie_generate_image',
    description: 'Generate stunning, professional-quality images from text prompts using KIE AI. Transform simple ideas into polished, detailed prompts for photorealistic, artistic, or commercial imagery. The user sees a loading animation during generation. Returns a task_id - poll the task to get the final image URL.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: 'Detailed, professionally crafted text description of the image to generate. Include subject, style, lighting, mood, colors, composition, and quality descriptors.' },
        model: { type: Type.STRING, description: 'Model to use, e.g. "flux-schnell" or "stable-diffusion-xl". Defaults to best available.' },
        guidance_scale: { type: Type.NUMBER, description: 'How closely to follow the prompt (1-20). Higher = more faithful. Default 7.5.' },
        num_steps: { type: Type.NUMBER, description: 'Number of inference steps. More = quality but slower. Default 30.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'kie_generate_video',
    description: 'Generate professional-quality AI videos from text prompts using KIE AI. Optimized for 12-second product showcases with cinematic lighting, smooth camera movements, and professional commercial aesthetics. Returns a task_id - poll the task to get the final video URL.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: 'Cinematic, detailed text description of the video. For product showcases: include visual narrative, camera motion, lighting, product placement, and style. Example: "12-second product showcase: elegant perfume bottle on marble surface, soft studio lighting, slow 360° orbit rotation, cinematic color grade, professional commercial quality".' },
        model: { type: Type.STRING, description: 'Video model to use, e.g. "zeroscope" or "modelscope". Defaults to best available.' },
        duration: { type: Type.NUMBER, description: 'Video duration in seconds. For product showcases, use 12 seconds. Default 5. Max varies by model.' },
        fps: { type: Type.NUMBER, description: 'Frames per second. Default 30. Higher = smoother motion.' },
        resolution: { type: Type.STRING, description: 'Resolution, e.g. "1024x576" or "512x512". Default varies by model.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'kie_poll_task',
    description: 'Poll a KIE generation task by task_id to get the result (image or video URL). Call this after kie_generate_image or kie_generate_video.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        task_id: { type: Type.STRING, description: 'The task_id returned from a generation call.' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'kie_upload_file',
    description: 'Upload a file to KIE storage from a URL, base64 data, or as a stream. Returns a file URL that can be used in other operations. Files are stored for 3 days.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        source: { type: Type.STRING, description: 'Source type: "url", "base64", or "stream".' },
        url: { type: Type.STRING, description: 'Remote URL to upload from (when source is "url").' },
        data: { type: Type.STRING, description: 'Base64 encoded file data (when source is "base64"). Include data URI prefix if present.' },
        fileName: { type: Type.STRING, description: 'Desired filename for the uploaded file.' },
        uploadPath: { type: Type.STRING, description: 'Optional path within KIE storage, e.g. "uploads" or "images".' },
      },
      required: ['source'],
    },
  },
  {
    name: 'kie_check_credits',
    description: 'Check the current account credit balance. Useful to verify available credits before starting generation tasks.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'kie_get_download_url',
    description: 'Get a temporary download URL for a KIE-generated file. Download links are valid for 20 minutes.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'The KIE file URL to get a download link for.' },
      },
      required: ['url'],
    },
  },
];
// HeyGen Video Agent Tools
const HEYGEN_TOOLS = [
  {
    name: 'heygen_create_video',
    description: 'Create professional AI-powered videos from text prompts using HeyGen Video Agent API. Supports avatar-based narration, script generation, and multi-scene composition. Pass a detailed prompt describing the video content, tone, style, and any reference files. Returns a session_id - poll the session to get the video_id, then poll for completion.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: 'Detailed text description of the video to create. Include: video topic, target audience, tone (professional/friendly/corporate), desired length, key messages, visual style references, and any specific avatar or voice preferences. Example: "Create a 30-second product launch announcement for our new AI assistant. Professional yet approachable tone. Include our company logo animation at the start and end."' },
        orientation: { type: Type.STRING, description: 'Video orientation: "landscape" for presentations/YouTube, "portrait" for mobile/social media. Defaults based on content if omitted.' },
        avatar_id: { type: Type.STRING, description: 'Specific avatar look ID from HeyGen. Omit to let the agent choose an appropriate avatar.' },
        voice_id: { type: Type.STRING, description: 'Specific voice ID for narration. Omit to let the agent choose automatically.' },
        style_id: { type: Type.STRING, description: 'Style ID for curated visual templates. See HeyGen styles documentation.' },
        callback_url: { type: Type.STRING, description: 'Optional webhook URL to receive notification on completion.' },
        callback_id: { type: Type.STRING, description: 'Caller-defined ID echoed back in webhook payload for tracking.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'heygen_poll_video',
    description: 'Poll for HeyGen video generation status and get the final video URL once completed. Use after heygen_create_video returns a session_id.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        session_id: { type: Type.STRING, description: 'The session_id returned from heygen_create_video.' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'heygen_list_videos',
    description: 'List all HeyGen-generated videos in the account with pagination.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER, description: 'Number of results per page (1-100). Default 10.' },
        token: { type: Type.STRING, description: 'Opaque cursor from a previous response for pagination.' },
      },
    },
  },
  {
    name: 'heygen_delete_video',
    description: 'Permanently delete a HeyGen video from the account.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        video_id: { type: Type.STRING, description: 'The video ID to delete.' },
      },
      required: ['video_id'],
    },
  },
];

function safeJsonStringify(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function makeDownloadFile(result: any, filenameBase: string, mime = 'application/json') {
  const body = mime === 'application/json' ? safeJsonStringify(result) : String(result);
  const data = `data:${mime};charset=utf-8,${encodeURIComponent(body)}`;
  const safe = filenameBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tool-result';

  return {
    downloadData: data,
    downloadFilename: `${safe}-${Date.now()}${mime === 'application/json' ? '.json' : '.txt'}`,
  };
}

function normalizeHtml(html: string) {
  const trimmed = String(html || '').trim();

  if (!trimmed) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Generated Artifact</title>
<style>
body{font-family:Arial,sans-serif;background:#111;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}
.card{max-width:720px;padding:32px;border:1px solid rgba(255,255,255,.15);border-radius:24px;background:rgba(255,255,255,.06)}
</style>
</head>
<body>
<div class="card">
<h1>Empty Artifact</h1>
<p>No HTML was provided.</p>
</div>
</body>
</html>`;
  }

  if (trimmed.toLowerCase().startsWith('<!doctype html')) return trimmed;

  if (trimmed.toLowerCase().startsWith('<html')) {
    return `<!DOCTYPE html>\n${trimmed}`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Generated Artifact</title>
</head>
<body>
${trimmed}
</body>
</html>`;
}

function makeHtmlArtifactFile(html: string, filenameBase: string) {
  const safe =
    String(filenameBase || 'artifact')
      .toLowerCase()
      .replace(/\.html$/i, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'artifact';

  const finalHtml = normalizeHtml(html);
  const data = `data:text/html;charset=utf-8,${encodeURIComponent(finalHtml)}`;

  return {
    html: finalHtml,
    htmlPreviewData: data,
    htmlPreviewFilename: `${safe}.html`,
    downloadData: data,
    downloadFilename: `${safe}.html`,
  };
}

function makeBlobDownloadData(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64UrlEncode(value: string) {
  return btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildEmailRaw({
  to,
  subject,
  body,
  cc,
  bcc,
  attachment,
}: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  attachment?: {
    filename: string;
    mimeType: string;
    base64Content: string;
  };
}) {
  const headers =[
    `To: ${to}`,
    cc ? `Cc: ${cc}` : '',
    bcc ? `Bcc: ${bcc}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ].filter(Boolean);

  if (!attachment) {
    const raw =[
      ...headers,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body,
    ].join('\r\n');

    return base64UrlEncode(raw);
  }

  const boundary = `boundary_${Date.now()}`;

  const raw =[
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
    '',
    `--${boundary}`,
    `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    '',
    attachment.base64Content,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return base64UrlEncode(raw);
}

function readableDateRange(date?: string, timeMin?: string, timeMax?: string) {
  const now = new Date();

  if (timeMin && timeMax) {
    return { timeMin, timeMax };
  }

  const target = date ? new Date(date) : now;
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);

  const end = new Date(target);
  end.setHours(23, 59, 59, 999);

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

// -------------------------------------------------------------
// HTML DOCUMENT GENERATORS (NON-AI TEMPLATES)
// -------------------------------------------------------------

function buildMeetingMinutesHtml(args: any) {
  const today = new Date().toLocaleDateString();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; padding: 2rem; margin: 0; }
  .doc { max-width: 800px; margin: 0 auto; background: white; padding: 4rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 6px solid #3b82f6; border-radius: 8px; }
  h1 { font-size: 2.5rem; margin-bottom: 0.5rem; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
  .meta { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 2rem; color: #64748b; }
  h2 { font-size: 1.4rem; color: #3b82f6; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 2.5rem; }
  ul { padding-left: 1.5rem; }
  li { margin-bottom: 0.5rem; }
  .highlight-box { background: #f1f5f9; padding: 1.5rem; border-radius: 6px; margin-top: 1rem; }
  @media print { body { padding: 0; background: white; } .doc { box-shadow: none; padding: 0; border-top: 4px solid #000; } }
</style>
</head>
<body>
  <div class="doc">
    <h1>Meeting Minutes</h1>
    <div class="meta">
      <div><strong>Subject:</strong> ${args.meetingTitle || 'General Sync'}</div>
      <div><strong>Date:</strong> ${args.date || today}</div>
    </div>
    <div style="margin-bottom: 2rem;"><strong>Attendees:</strong> ${args.attendees || 'N/A'}</div>
    
    <h2>Executive Summary</h2>
    <div class="highlight-box">
      <p style="margin:0;">${args.summary || 'No summary provided.'}</p>
    </div>
    
    <h2>Key Decisions</h2>
    ${args.decisions || '<p>None recorded.</p>'}
    
    <h2>Action Items</h2>
    ${args.actionItems || '<p>None recorded.</p>'}
  </div>
  <script>
    window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); window.print(); } });
  </script>
</body>
</html>`;
}

function buildInvoiceHtml(args: any) {
  const today = new Date().toLocaleDateString();
  let itemsHtml = '';
  let subtotal = 0;
  
  let parsedItems =[];
  try {
    parsedItems = typeof args.items === 'string' ? JSON.parse(args.items) : args.items;
  } catch (e) {
    // ignore
  }

  if (!Array.isArray(parsedItems)) parsedItems =[];
  
  parsedItems.forEach((item: any) => {
    const qty = parseFloat(item.quantity || 1);
    const price = parseFloat(item.price || 0);
    const total = qty * price;
    subtotal += total;
    itemsHtml += `<tr>
      <td style="padding:1rem; border-bottom:1px solid #e2e8f0;">${item.description || 'Item'}</td>
      <td style="padding:1rem; border-bottom:1px solid #e2e8f0; text-align:center;">${qty}</td>
      <td style="padding:1rem; border-bottom:1px solid #e2e8f0; text-align:right;">$${price.toFixed(2)}</td>
      <td style="padding:1rem; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:bold;">$${total.toFixed(2)}</td>
    </tr>`;
  });

  const taxRate = parseFloat(args.taxRate || 0);
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 2rem; margin: 0; }
  .doc { max-width: 800px; margin: 0 auto; background: white; padding: 4rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-radius: 8px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3rem; }
  h1 { font-size: 3rem; margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 2rem; }
  th { background: #f1f5f9; padding: 1rem; text-align: left; text-transform: uppercase; font-size: 0.85rem; color: #64748b; }
  .totals { width: 50%; float: right; margin-top: 2rem; background: #f8fafc; padding: 1.5rem; border-radius: 8px; }
  .totals table { margin-top: 0; }
  .clearfix::after { content: ""; clear: both; display: table; }
  @media print { body { padding: 0; background: white; } .doc { box-shadow: none; padding: 0; } }
</style>
</head>
<body>
  <div class="doc clearfix">
    <div class="header">
      <div>
        <h1>INVOICE</h1>
        <div style="color: #64748b; margin-top: 0.5rem; font-size: 1.1rem;"># ${args.invoiceNumber || Math.floor(Math.random() * 10000)}</div>
      </div>
      <div style="text-align: right; line-height: 1.6;">
        <strong style="color: #0f172a;">Billed To:</strong><br>
        <span style="font-size: 1.1rem;">${args.clientName || 'Valued Client'}</span><br>
        <div style="margin-top: 1rem;"><strong>Date:</strong> ${args.date || today}</div>
      </div>
    </div>
    
    <table>
      <thead>
        <tr><th>Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr>
      </thead>
      <tbody>
        ${itemsHtml || '<tr><td colspan="4" style="text-align:center; padding:1rem;">No items</td></tr>'}
      </tbody>
    </table>
    
    <div class="totals">
      <table>
        <tr><td style="padding:0.5rem; color: #64748b;">Subtotal</td><td style="text-align:right;">$${subtotal.toFixed(2)}</td></tr>
        <tr><td style="padding:0.5rem; color: #64748b;">Tax (${taxRate}%)</td><td style="text-align:right;">$${taxAmount.toFixed(2)}</td></tr>
        <tr><td style="padding:1rem 0.5rem; font-size:1.4rem; font-weight:bold; color: #0f172a; border-top:2px solid #cbd5e1;">Total</td><td style="text-align:right; font-size:1.4rem; font-weight:bold; color: #0f172a; border-top:2px solid #cbd5e1;">$${grandTotal.toFixed(2)}</td></tr>
      </table>
    </div>
  </div>
  <script>
    window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); window.print(); } });
  </script>
</body>
</html>`;
}

function buildDashboardHtml(args: any) {
  let labels = [];
  let datasets =[];
  try {
    labels = typeof args.labels === 'string' ? args.labels.split(',') : args.labels;
  } catch (e) {}

  try {
    datasets = typeof args.datasets === 'string' ? JSON.parse(args.datasets) : args.datasets;
  } catch (e) {}
  
  return `<!DOCTYPE html>
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Inter', sans-serif; background: #0f172a; padding: 2rem; display: flex; justify-content: center; margin: 0; min-height: 100vh; align-items: center; }
  .card { background: white; padding: 3rem; border-radius: 16px; width: 100%; max-width: 900px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
  h2 { text-align: center; color: #1e293b; margin-top: 0; margin-bottom: 2rem; font-size: 2rem; }
</style>
</head>
<body>
  <div class="card">
    <h2>${args.title || 'Data Dashboard'}</h2>
    <canvas id="myChart"></canvas>
  </div>
  <script>
    new Chart(document.getElementById('myChart'), {
      type: '${args.chartType || 'bar'}',
      data: {
        labels: ${JSON.stringify(labels && labels.length ? labels : ['A','B','C'])},
        datasets: ${JSON.stringify(datasets && datasets.length ? datasets : [{label: 'Data', data:[1,2,3]}])}
      },
      options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });
  </script>
</body>
</html>`;
}

function buildGanttHtml(args: any) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Inter', sans-serif; background: #0f172a; padding: 2rem; display: flex; justify-content: center; margin: 0; min-height: 100vh; align-items: center; }
  .card { background: white; padding: 3rem; border-radius: 16px; width: 100%; max-width: 1000px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); overflow-x: auto; }
  h2 { color: #1e293b; margin-top: 0; margin-bottom: 2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; font-size: 2rem; }
</style>
</head>
<body>
  <div class="card">
    <h2>${args.title || 'Project Timeline'}</h2>
    <div class="mermaid">
gantt
    title ${args.title || 'Timeline'}
    dateFormat  YYYY-MM-DD
    ${args.tasks || 'Section\\nTask 1 :a1, 2023-01-01, 30d'}
    </div>
  </div>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'base', themeVariables: { primaryColor: '#3b82f6', primaryTextColor: '#fff', primaryBorderColor: '#2563eb', lineType: 'curve' } });
  </script>
</body>
</html>`;
}

function buildStunningHtmlContract({
  title,
  contractType,
  partyA,
  partyB,
  effectiveDate,
  jurisdiction,
  terms,
}: any) {
  const today = new Date().toLocaleDateString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title || 'Contract Agreement'}</title>
<style>
  :root { --primary: #1a1a1a; --secondary: #4a4a4a; --accent: #2c5282; --bg: #f8fafc; --paper: #ffffff; --border: #e2e8f0; }
  body { font-family: 'Georgia', serif; background-color: var(--bg); color: var(--primary); line-height: 1.6; padding: 2rem; margin: 0; display: flex; justify-content: center; }
  .document { background: var(--paper); width: 100%; max-width: 800px; padding: 4rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 8px solid var(--accent); }
  .header { text-align: center; margin-bottom: 3rem; border-bottom: 2px solid var(--border); padding-bottom: 2rem; }
  .title { font-size: 2.2rem; font-weight: normal; color: var(--primary); margin: 0 0 1rem 0; text-transform: uppercase; letter-spacing: 2px; }
  .subtitle { font-size: 1.2rem; color: var(--secondary); font-style: italic; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 3rem; background: #f1f5f9; padding: 1.5rem; border-radius: 4px; }
  .meta-item strong { display: block; font-size: 0.85rem; text-transform: uppercase; color: var(--secondary); letter-spacing: 1px; margin-bottom: 0.25rem; }
  .section { margin-bottom: 2.5rem; }
  .section h2 { font-size: 1.4rem; color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; margin-top: 5rem; }
  .signature-block { border-top: 1px solid var(--primary); padding-top: 1rem; }
  .signature-block strong { display: block; margin-bottom: 0.5rem; }
  @media print { body { background: white; padding: 0; } .document { box-shadow: none; max-width: 100%; padding: 0; border-top: 4px solid #000; } }
</style>
</head>
<body>
  <div class="document">
    <div class="header">
      <h1 class="title">${title || 'Contract Agreement'}</h1>
      <div class="subtitle">${contractType || 'Legal Agreement'}</div>
    </div>
    <div class="meta-grid">
      <div class="meta-item"><strong>Effective Date</strong><div>${effectiveDate || today}</div></div>
      <div class="meta-item"><strong>Jurisdiction</strong><div>${jurisdiction || 'Applicable Jurisdiction'}</div></div>
      <div class="meta-item"><strong>Party A</strong><div>${partyA || 'First Party'}</div></div>
      <div class="meta-item"><strong>Party B</strong><div>${partyB || 'Second Party'}</div></div>
    </div>
    <div class="section">
      <h2>1. Purpose & Scope</h2>
      <p>This Agreement sets out the terms and conditions under which the parties agree to work together. The specific scope of this Agreement includes the following:</p>
      <div style="background:#f8fafc; padding:1.5rem; border-left:4px solid var(--accent); margin-top:1rem;">
        ${(terms || 'The parties will define the scope in writing.').replace(/\n/g, '<br>')}
      </div>
    </div>
    <div class="section"><h2>2. Responsibilities & Obligations</h2><p>Each party agrees to act in good faith, perform its obligations with reasonable care, and communicate promptly regarding any material issue that may affect performance.</p></div>
    <div class="section"><h2>3. Payment & Consideration</h2><p>Any payment, fees, or consideration shall be handled according to the terms specifically agreed by the parties in writing or outlined in attached exhibits.</p></div>
    <div class="section"><h2>4. Confidentiality & Intellectual Property</h2><p>Each party agrees to keep confidential information private and not disclose it to third parties except where required by law or agreed in writing. Unless otherwise agreed, each party retains ownership of its pre-existing intellectual property.</p></div>
    <div class="section"><h2>5. Term & Termination</h2><p>This Agreement begins on the Effective Date and continues until completed, terminated by mutual agreement, or terminated according to written terms agreed by the parties.</p></div>
    <div class="section"><h2>6. Governing Law</h2><p>This Agreement shall be governed by and construed in accordance with the laws of ${jurisdiction || 'the applicable jurisdiction'}. Any disputes arising under this agreement will be resolved in the appropriate courts of this jurisdiction.</p></div>
    <div class="signatures">
      <div class="signature-block"><strong>${partyA || 'Party A'}</strong><div style="color:#666; font-size:0.9rem; margin-top:0.5rem;">Signature</div><div style="margin-top:2.5rem; border-bottom:1px solid #ccc; width:85%;"></div><div style="color:#666; font-size:0.9rem; margin-top:0.5rem;">Date</div></div>
      <div class="signature-block"><strong>${partyB || 'Party B'}</strong><div style="color:#666; font-size:0.9rem; margin-top:0.5rem;">Signature</div><div style="margin-top:2.5rem; border-bottom:1px solid #ccc; width:85%;"></div><div style="color:#666; font-size:0.9rem; margin-top:0.5rem;">Date</div></div>
    </div>
  </div>
  <script>window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); window.print(); } });</script>
</body>
</html>`;
}

// -------------------------------------------------------------
// UI COMPONENTS
// -------------------------------------------------------------

function OneLineStreamingTranscript({
  text,
  role,
  name,
}: {
  text: string;
  role: 'user' | 'model';
  name: string;
}) {
  return (
    <motion.div
      key={`${role}-${text}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.12 }}
      className="w-full overflow-hidden px-4"
      style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 overflow-hidden whitespace-nowrap rounded-full border border-lime-300/15 bg-black/35 px-5 py-3 shadow-2xl backdrop-blur-2xl">
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] ${
            role === 'user'
              ? 'border border-sky-400/20 bg-sky-500/10 text-sky-300'
              : 'border border-lime-300/25 bg-lime-400/10 text-lime-300'
          }`}
        >
          {role === 'user' ? 'You' : name}
        </span>

        <div className="min-w-0 flex-1 overflow-hidden">
          <p
            className={`truncate text-left text-lg font-medium leading-none tracking-tight md:text-2xl ${
              role === 'user' ? 'text-sky-100' : 'text-lime-50'
            }`}
          >
            {text}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function LimeVoiceOrb({
  isActive,
  isAgentSpeaking,
  speakerLevel,
  speakerBands,
}: {
  isActive: boolean;
  isAgentSpeaking: boolean;
  speakerLevel: number;
  speakerBands: number[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(0);
  const bandsRef = useRef<number[]>(Array(20).fill(0));
  const activeRef = useRef(false);
  const speakingRef = useRef(false);

  useEffect(() => {
    levelRef.current = speakerLevel;
    bandsRef.current = speakerBands;
    activeRef.current = isActive;
    speakingRef.current = isAgentSpeaking;
  }, [isActive, isAgentSpeaking, speakerBands, speakerLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let frame = 0;
    let raf = 0;
    let displayLevel = 0;

    const fitCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return {
        width: width / dpr,
        height: height / dpr,
      };
    };

    const makeOrbPath = (cx: number, cy: number, radius: number, pulse: number, time: number) => {
      const path = new Path2D();
      const points: Array<{ x: number; y: number }> =[];
      const bands = bandsRef.current.length ? bandsRef.current : Array(20).fill(0);
      const live = activeRef.current && speakingRef.current;
      const count = 112;

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const band = bands[i % bands.length] || 0;
        const surface =
          Math.sin(angle * 2.1 + time * 0.95) * (live ? 2.5 : 0.9) +
          Math.sin(angle * 3.7 - time * 0.68) * (live ? 1.7 : 0.55) +
          band * (live ? 8.5 : 1.8);
        const r = radius + pulse * 8 + surface;

        points.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        });
      }

      points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        const midX = (point.x + next.x) / 2;
        const midY = (point.y + next.y) / 2;

        if (index === 0) {
          path.moveTo(midX, midY);
        } else {
          path.quadraticCurveTo(point.x, point.y, midX, midY);
        }
      });

      path.closePath();
      return path;
    };

    const drawGlow = (cx: number, cy: number, radius: number, inner: string, outer: string) => {
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, inner);
      gradient.addColorStop(1, outer);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const draw = () => {
      const { width, height } = fitCanvas();
      const cx = width / 2;
      const cy = height / 2;
      const time = frame / 60;
      const rawLevel = activeRef.current ? Math.max(levelRef.current, speakingRef.current ? 0.035 : 0) : 0;
      displayLevel += (rawLevel - displayLevel) * 0.16;
      const bands = bandsRef.current.length ? bandsRef.current : Array(20).fill(0);
      const bandEnergy = bands.reduce((sum, band) => sum + band, 0) / Math.max(bands.length, 1);
      const pulse = Math.min(1, Math.max(displayLevel, bandEnergy * 1.25));
      const live = activeRef.current && speakingRef.current;
      const baseRadius = 93;

      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.globalAlpha = activeRef.current ? 0.42 + pulse * 0.28 : 0.24;
      ctx.filter = 'blur(34px)';
      drawGlow(cx, cy, 118 + pulse * 22, 'rgba(190,242,100,0.42)', 'rgba(22,101,52,0)');
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = activeRef.current ? 0.24 + pulse * 0.26 : 0.12;
      ctx.strokeStyle = 'rgba(190,242,100,0.34)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 116 + pulse * 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const orbPath = makeOrbPath(cx, cy, baseRadius, pulse, time);

      ctx.save();
      ctx.shadowColor = 'rgba(190,242,100,0.38)';
      ctx.shadowBlur = 38 + pulse * 28;
      const bodyGradient = ctx.createRadialGradient(cx - 38, cy - 48, 8, cx, cy, 126);
      bodyGradient.addColorStop(0, 'rgba(236,252,203,0.76)');
      bodyGradient.addColorStop(0.27, 'rgba(163,230,53,0.58)');
      bodyGradient.addColorStop(0.58, 'rgba(34,197,94,0.46)');
      bodyGradient.addColorStop(1, 'rgba(5,46,22,0.96)');
      ctx.fillStyle = bodyGradient;
      ctx.fill(orbPath);
      ctx.restore();

      ctx.save();
      ctx.clip(orbPath);
      ctx.globalCompositeOperation = 'screen';
      drawGlow(
        cx - 38 + Math.sin(time * 0.7) * 12,
        cy - 34 + Math.cos(time * 0.55) * 10,
        78 + pulse * 12,
        'rgba(236,252,203,0.52)',
        'rgba(236,252,203,0)'
      );
      drawGlow(
        cx + 40 + Math.cos(time * 0.62) * 14,
        cy + 24 + Math.sin(time * 0.75) * 12,
        90 + pulse * 18,
        'rgba(16,185,129,0.44)',
        'rgba(16,185,129,0)'
      );
      drawGlow(
        cx - 6 + Math.sin(time * 0.5) * 18,
        cy + 34 + Math.cos(time * 0.46) * 10,
        98,
        'rgba(132,204,22,0.22)',
        'rgba(132,204,22,0)'
      );
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = `rgba(217,249,157,${0.16 + pulse * 0.26})`;
      ctx.lineWidth = 1.4;
      ctx.stroke(orbPath);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = live ? 0.14 + pulse * 0.18 : 0.06;
      ctx.fillStyle = 'rgba(255,255,255,0.58)';
      ctx.beginPath();
      ctx.ellipse(cx - 36, cy - 46, 24 + pulse * 6, 11 + pulse * 3, -0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      frame += 1;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  },[]);

  return (
    <div className="relative flex h-72 w-72 items-center justify-center">
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
    </div>
  );
}

function SpeakerVisualizer({
  isActive,
  isSpeaking,
  speakerLevel,
  speakerBands,
}: {
  isActive: boolean;
  isSpeaking: boolean;
  speakerLevel: number;
  speakerBands: number[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(0);
  const bandsRef = useRef<number[]>(Array(20).fill(0));
  const activeRef = useRef(false);
  const speakingRef = useRef(false);

  useEffect(() => {
    levelRef.current = speakerLevel;
    bandsRef.current = speakerBands;
    activeRef.current = isActive;
    speakingRef.current = isSpeaking;
  }, [isActive, isSpeaking, speakerBands, speakerLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let frame = 0;
    let raf = 0;
    let displayLevel = 0;

    const fitCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return {
        width: width / dpr,
        height: height / dpr,
      };
    };

    const makeOrbPath = (cx: number, cy: number, radius: number, pulse: number, time: number) => {
      const path = new Path2D();
      const points: Array<{ x: number; y: number }> = [];
      const bands = bandsRef.current.length ? bandsRef.current : Array(20).fill(0);
      const live = activeRef.current && speakingRef.current;

      const numPoints = 40;
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const influence = bands[i % bands.length];
        const mod = live ? influence * radius * 0.45 : 0;
        const r = radius + mod + pulse * radius * 0.1;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      path.closePath();
      return path;
    };

    const draw = () => {
      frame++;
      const { width, height } = fitCanvas();
      const cx = width / 2;
      const cy = height / 2;
      const baseR = Math.min(width, height) * 0.32;

      ctx.clearRect(0, 0, width, height);
      const live = activeRef.current && speakingRef.current;
      const targetLevel = live ? levelRef.current : Math.max(0, displayLevel * 0.92 + (0.15 + 0.1 * (bandsRef.current[0] || 0)) * 0.08);
      displayLevel = targetLevel;
      const pulse = live ? 0.18 + targetLevel * 0.35 : 0.06 + (frame % 60 < 30 ? 0 : 0.06);
      const time = frame * 0.012;

      const orbPath = makeOrbPath(cx, cy, baseR, pulse, time);

      const grd = ctx.createRadialGradient(cx, cy, baseR * 0.15, cx, cy, baseR * (1.2 + pulse * 0.5));
      grd.addColorStop(0, 'rgba(190,242,100,0.18)');
      grd.addColorStop(0.5, 'rgba(190,242,100,0.05)');
      grd.addColorStop(1, 'rgba(190,242,100,0)');
      ctx.fillStyle = grd;
      ctx.fill(orbPath);

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = live ? 'rgba(190,242,100,0.65)' : 'rgba(190,242,100,0.18)';
      ctx.stroke(orbPath);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative flex h-8 w-8 items-center justify-center">
      <canvas ref={canvasRef} className="h-full w-full" aria-label="AI voice visualizer" />
    </div>
  );
}

function HeaderAudioVisualizer({
  isActive,
  isSpeaking,
  isMuted,
  speakerLevel,
  speakerBands,
}: {
  isActive: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  speakerLevel: number;
  speakerBands: number[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speakerLevelRef = useRef(0);
  const speakerBandsRef = useRef<number[]>(Array(20).fill(0));
  const activeRef = useRef(false);
  const speakingRef = useRef(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    speakerLevelRef.current = speakerLevel;
    speakerBandsRef.current = speakerBands;
    activeRef.current = isActive;
    speakingRef.current = isSpeaking;
    mutedRef.current = isMuted;
  }, [isActive, isSpeaking, isMuted, speakerBands, speakerLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let speakerDisplayLevel = 0;

    const fitCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width: width / dpr, height: height / dpr };
    };

    const draw = () => {
      const { width, height } = fitCanvas();
      const live = activeRef.current;
      const speaking = speakingRef.current;
      const muted = mutedRef.current;

      ctx.clearRect(0, 0, width, height);

      const totalBarCount = 32;
      const barWidth = (width / totalBarCount) * 0.65;
      const gap = (width / totalBarCount) * 0.35;
      const maxHeight = height * 0.85;
      const centerY = height / 2;

      const speakerBars = speakerBandsRef.current.length ? speakerBandsRef.current : Array(16).fill(0);

      for (let i = 0; i < totalBarCount; i++) {
        const speakerVal = speakerBars[i % speakerBars.length] || 0;

        const speakerTarget = (live && speaking) ? Math.max(0.08, speakerVal) * maxHeight : maxHeight * 0.06;

        speakerDisplayLevel = speakerDisplayLevel * 0.85 + speakerTarget * 0.15;
        const barHeight = Math.max(2, speakerDisplayLevel);

        const x = i * (barWidth + gap);
        const y = centerY - barHeight / 2;

        let r, g, b, a;
        if (muted) {
          r = 239; g = 68; b = 68; a = 0.25;
        } else if (live && speaking) {
          const t = speakerVal;
          r = Math.round(100 + t * 90);
          g = Math.round(200 + t * 55);
          b = Math.round(255);
          a = 0.75 + t * 0.2;
        } else {
          r = 100; g = 200; b = 255; a = 0.2;
        }

        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative flex h-6 items-center justify-center">
      <canvas ref={canvasRef} className="h-full w-full" aria-label="Audio visualizer" />
    </div>
  );
}

function HeaderMicVisualizer({
  isActive,
  isMuted,
  micLevel,
  micBands,
}: {
  isActive: boolean;
  isMuted: boolean;
  micLevel: number;
  micBands: number[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(0);
  const bandsRef = useRef<number[]>(Array(20).fill(0));
  const activeRef = useRef(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    levelRef.current = micLevel;
    bandsRef.current = micBands;
    activeRef.current = isActive;
    mutedRef.current = isMuted;
  }, [isActive, isMuted, micBands, micLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let displayLevel = 0;

    const fitCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width: width / dpr, height: height / dpr };
    };

    const draw = () => {
      const { width, height } = fitCanvas();
      const live = activeRef.current && !mutedRef.current;

      ctx.clearRect(0, 0, width, height);

      const bands = bandsRef.current.length ? bandsRef.current : Array(20).fill(0);
      const barCount = 12;
      const barWidth = (width / barCount) * 0.6;
      const gap = (width / barCount) * 0.4;
      const maxHeight = height * 0.8;

      for (let i = 0; i < barCount; i++) {
        const bandValue = bands[i % bands.length] || 0;
        const targetHeight = live ? Math.max(0.08, bandValue) * maxHeight : maxHeight * 0.06;
        displayLevel = displayLevel * 0.82 + targetHeight * 0.18;
        const barHeight = Math.max(2, displayLevel);

        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = isMuted ? 'rgba(239,68,68,0.6)' : (live ? 'rgba(190,242,100,0.9)' : 'rgba(190,242,100,0.25)');
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 1);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative flex h-8 items-center justify-center">
      <canvas ref={canvasRef} className="h-full w-full" aria-label="Mic input visualizer" />
    </div>
  );
}

// -------------------------------------------------------------
// FULL-SCREEN LIVE ARTIFACT PREVIEW (LIVE-SERVER STYLE)
// -------------------------------------------------------------
function LiveArtifactPreview({
  data,
  filename,
  onClose,
  onDownload,
}: {
  data: string;
  filename: string;
  onClose: () => void;
  onDownload?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const handleReload = () => {
    setIframeKey(k => k + 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] flex flex-col bg-[#0A0A0B]"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#111113] px-4 py-3">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition"
          title="Close preview"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex h-9 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#0A0A0B] px-3">
          <div className="flex items-center gap-1.5 text-zinc-500">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
          </div>
          <span className="min-w-0 flex-1 truncate text-xs font-mono text-zinc-300">
            {filename}
          </span>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            LIVE
          </span>
        </div>

        <button
          onClick={handleReload}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition"
          title="Reload preview"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>

        <button
          onClick={() => window.open(data, '_blank', 'noopener,noreferrer')}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-lime-300/20 bg-lime-300/10 text-lime-300 hover:bg-lime-300/20 transition"
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </button>

        {onDownload && (
          <button
            onClick={onDownload}
            className="flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-500 transition"
            title="Download artifact"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
        )}
      </div>

      {/* Full-screen iframe */}
      <div className="flex-1 bg-white">
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={data}
          title={filename}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </motion.div>
  );
}

function StartIconMicVisualizer({
  isActive,
  connecting,
  isMuted,
  micLevel,
  micBands,
  onClick,
}: {
  isActive: boolean;
  connecting: boolean;
  isMuted: boolean;
  micLevel: number;
  micBands?: number[];
  onClick: () => void;
}) {
  const innerBands = micBands?.length
    ? micBands.slice(3, 17)
    : [0.35, 0.5, 0.72, 0.9, 1, 0.82, 0.64, 0.46, 0.32].map(n => n * micLevel);

  const outerRingBands = micBands?.length
    ? micBands.slice(0, 16)
    : Array(16).fill(micLevel * 0.4);

  return (
    <button
      onClick={onClick}
      disabled={connecting}
      aria-label={isActive ? 'Stop voice session' : 'Start voice session'}
      className="group relative flex h-20 w-20 items-center justify-center"
    >
      {/* Outer pulsing ring based on mic level */}
      <motion.div
        animate={{
          scale: isActive && !isMuted ? 1 + micLevel * 0.22 : 1,
          opacity: isActive && !isMuted ? 0.08 + micLevel * 0.25 : 0.04,
        }}
        transition={{ duration: 0.06 }}
        className={`absolute -inset-2 rounded-full ${
          isMuted ? 'bg-red-500/15' : 'bg-lime-300/25'
        } blur-sm`}
      />

      {/* Outer frequency ring */}
      <svg
        className="absolute -inset-3 h-[calc(100%+24px)] w-[calc(100%+24px)]"
        viewBox="0 0 104 104"
        aria-hidden="true"
      >
        {outerRingBands.map((band, i) => {
          const angle = (i / outerRingBands.length) * Math.PI * 2 - Math.PI / 2;
          const innerR = 46;
          const outerR = innerR + 2 + (isActive && !isMuted ? band * 6 : 1);
          const x1 = 52 + Math.cos(angle) * innerR;
          const y1 = 52 + Math.sin(angle) * innerR;
          const x2 = 52 + Math.cos(angle) * outerR;
          const y2 = 52 + Math.sin(angle) * outerR;
          return (
            <motion.line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              animate={{
                opacity: isActive && !isMuted ? Math.max(0.15, band + 0.3) : 0.08,
              }}
              transition={{ duration: 0.04 }}
              stroke={isMuted ? '#ef4444' : '#bef264'}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      <motion.div
        animate={{
          opacity: isActive ? 0.12 + micLevel * 0.28 : 0.06,
        }}
        transition={{ duration: 0.045 }}
        className={`absolute inset-0 rounded-full ${
          isMuted ? 'bg-red-500/15' : 'bg-lime-300/20'
        }`}
      />

      <div
        className={`relative flex h-20 w-20 items-center justify-center rounded-full border bg-[#0A0A0B] shadow-2xl transition-all ${
          isActive
            ? isMuted
              ? 'border-red-500/35'
              : 'border-lime-300/60'
            : 'border-white/10 group-hover:border-lime-300/50'
        }`}
      >
        {connecting ? (
          <Loader2 className="h-7 w-7 animate-spin text-lime-300" />
        ) : isActive ? (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
            <div className="flex h-12 items-center gap-[3px]">
              {innerBands.map((band, i) => {
                const liveBand = isMuted ? 0 : Math.max(band, micLevel * 0.35);

                return (
                  <motion.div
                    key={i}
                    animate={{
                      height: Math.max(4, liveBand * 44),
                      opacity: isMuted ? 0.18 : Math.max(0.35, liveBand + 0.2),
                    }}
                    transition={{ duration: 0.03 }}
                    className={`w-[5px] rounded-full ${
                      isMuted
                        ? 'bg-red-500'
                        : 'bg-lime-300 shadow-[0_0_12px_rgba(190,242,100,0.85)]'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <Power className="h-8 w-8 text-lime-300 transition-colors" />
        )}
      </div>
    </button>
  );
}

// -------------------------------------------------------------
// DEDICATED MEETING RECORDER OVERLAY (100% FULL SCREEN)
// -------------------------------------------------------------
function MeetingRecorderModal({
  onClose,
  onProcess,
}: {
  onClose: () => void;
  onProcess: (transcript: string) => Promise<void>;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
    
  const isRecordingRef = useRef(false);
  
  const[micLevel, setMicLevel] = useState(0);
  const[micBands, setMicBands] = useState<number[]>(Array(32).fill(0));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    isRecordingRef.current = isRecording;
    if (isRecording) {
      const timer = setInterval(() => setDuration(d => d + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const bandCount = 32;

      const updateLevel = () => {
        if (!isRecordingRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setMicLevel(avg / 255);

        // Extract frequency bands for visualizer
        const bands = [];
        const step = Math.floor(dataArray.length / bandCount);
        for (let i = 0; i < bandCount; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += dataArray[i * step + j];
          }
          bands.push((sum / step) / 255);
        }
        setMicBands(bands);

        animationRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();

      // Browser Web Speech transcription is disabled. Use Gemini Live Audio as the only transcript source.
      setIsRecording(true);
    } catch(err) {
      console.error(err);
      alert("Microphone access is required to record the meeting.");
    }
  };

  const stopRecordingAndProcess = async () => {
    setIsRecording(false);
    setIsProcessing(true);
    
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    await onProcess("");
    onClose();
  };

  const handleCancel = () => {
    setIsRecording(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-[#050505] p-6 sm:p-12 items-center justify-center">
      <div className="w-full h-full flex flex-col max-w-5xl items-center justify-center">
        {isProcessing ? (
           <div className="flex flex-col items-center py-20 text-center">
             <Loader2 className="w-16 h-16 text-lime-300 animate-spin mb-8" />
             <h3 className="text-3xl font-bold text-white mb-4">Analyzing Meeting...</h3>
             <p className="text-zinc-500 text-lg max-w-lg">
               Beatrice is reviewing the transcript, generating formal minutes, and extracting tasks to update your schedule.
             </p>
           </div>
        ) : (
           <>
             <div className="flex justify-between items-center w-full mb-12">
               <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Meeting Recorder</h2>
               <button onClick={handleCancel} className="text-zinc-500 hover:text-white transition" title="Close meeting recorder">
                <X className="w-8 h-8" />
              </button>
             </div>
             
             <div className="flex-1 flex flex-col justify-center items-center w-full">
               <div className="relative flex items-center justify-center w-48 h-48 mb-10">
                 {isRecording && (
                   <motion.div
                     animate={{ scale: [1, 1 + micLevel * 0.6, 1], opacity:[0.3, 0.7, 0.3] }}
                     transition={{ duration: 0.1, repeat: Infinity }}
                     className="absolute inset-0 bg-lime-300/30 rounded-full blur-2xl"
                   />
                 )}
                 <button
                   onClick={isRecording ? stopRecordingAndProcess : startRecording}
                   className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                     isRecording
                       ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_40px_rgba(239,68,68,0.6)]'
                       : 'bg-lime-300 hover:bg-lime-400 text-black shadow-[0_0_40px_rgba(190,242,100,0.4)]'
                   }`}
                 >
                   {isRecording ? (
                     <div className="flex items-end justify-center gap-1 h-10">
                       {micBands.slice(0, 8).map((band, i) => (
                         <div
                           key={i}
                           className="w-2 bg-white rounded-full transition-all duration-75"
                           style={{
                             height: `${Math.max(4, Math.min(40, band * 40))}px`,
                           }}
                         />
                       ))}
                     </div>
                   ) : (
                     <Mic className="w-14 h-14" />
                   )}
                 </button>
                 {/* Outer frequency ring when recording */}
                 {isRecording && (
                   <svg
                     className="absolute inset-0 w-full h-full"
                     viewBox="0 0 192 192"
                     aria-hidden="true"
                   >
                     {micBands.slice(0, 16).map((band, i) => {
                       const angle = (i / 16) * Math.PI * 2 - Math.PI / 2;
                       const innerR = 80;
                       const outerR = innerR + 8 + band * 12;
                       const cx = 96;
                       const cy = 96;
                       const x1 = cx + Math.cos(angle) * innerR;
                       const y1 = cy + Math.sin(angle) * innerR;
                       const x2 = cx + Math.cos(angle) * outerR;
                       const y2 = cy + Math.sin(angle) * outerR;
                       return (
                         <motion.line
                           key={i}
                           x1={x1} y1={y1} x2={x2} y2={y2}
                           stroke="rgba(190, 242, 100, 0.6)"
                           strokeWidth={2}
                           strokeLinecap="round"
                           initial={{ opacity: 0.3 }}
                           animate={{ opacity: 0.4 + band * 0.6 }}
                         />
                       );
                     })}
                   </svg>
                 )}
               </div>

               <div className="text-6xl font-mono text-white mb-10 tracking-widest drop-shadow-lg">
                 {String(Math.floor(duration / 60)).padStart(2, '0')}:{String(duration % 60).padStart(2, '0')}
               </div>

               <div className="w-full bg-black/50 rounded-2xl p-6 h-64 overflow-y-auto border border-white/10 mb-10 shadow-inner">
                 <p className="text-lg text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">
                   {"Recording audio only. Visible transcription is reserved for Gemini Live Audio."}
                 </p>
               </div>

               <div className="flex gap-6 w-full max-w-2xl">
                  <button onClick={handleCancel} className="flex-1 py-4 rounded-full border border-white/10 text-zinc-400 font-bold uppercase tracking-widest hover:bg-white/5 transition">
                    Cancel
                  </button>
                  {isRecording && (
                    <button onClick={stopRecordingAndProcess} className="flex-1 py-4 rounded-full bg-lime-300 text-black font-bold uppercase tracking-widest hover:bg-lime-400 transition shadow-[0_0_30px_rgba(190,242,100,0.3)]">
                      Process Meeting
                    </button>
                  )}
               </div>
             </div>
           </>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// DOCUMENT SHORTCUTS
// -------------------------------------------------------------
const DOCUMENT_SKILLS = [
  { label: 'Invoice', icon: FileText, border: 'border-emerald-400/30', bg: 'bg-emerald-400/10', text: 'text-emerald-200', hover: 'hover:bg-emerald-400/20', prompt: 'Create a professional Belgian-ready invoice as a self-contained web artifact. Use this sample data: Seller: Eburon AI Services BV, VAT BE0400378485, Address: Rue de la Loi 100, 1040 Brussels. Buyer: ABC Corp, VAT BE0123456789. Invoice #INV-2024-001 dated today, due in 30 days. Line items: AI Consulting 40h x EUR 150 = EUR 6,000; Software License 1 x EUR 500 = EUR 500. Subtotal EUR 6,500. VAT 21% = EUR 1,365. Total EUR 7,865. Include print CSS, PDF-ready layout, and CSV export.' },
  { label: 'Quote', icon: FileText, border: 'border-lime-400/30', bg: 'bg-lime-400/10', text: 'text-lime-200', hover: 'hover:bg-lime-400/20', prompt: 'Create a polished quotation/estimate as a self-contained web artifact. Use this sample data: Quote #Q-2024-042 from Eburon AI to XYZ Manufacturing. Project: Custom AI Dashboard. Items: Discovery Phase EUR 2,500; UI/UX Design EUR 3,000; Development EUR 8,000; Testing EUR 1,500. Subtotal EUR 15,000. VAT 21% EUR 3,150. Total EUR 18,150. Valid 30 days. Include acceptance signature block, print CSS, and PDF-ready layout.' },
  { label: 'Receipt', icon: FileText, border: 'border-teal-400/30', bg: 'bg-teal-400/10', text: 'text-teal-200', hover: 'hover:bg-teal-400/20', prompt: 'Create a modern receipt document as a self-contained web artifact. Use this sample data: Store: Eburon Digital Solutions, Receipt #R-240514-88, Date: today, Customer: John Doe, Payment: Visa ending 4242. Items: Laptop Stand 1 x EUR 29.99 = EUR 29.99; Wireless Mouse 1 x EUR 45.00 = EUR 45.00. Subtotal EUR 74.99. VAT 21% EUR 15.75. Total EUR 90.74. Include print/PDF controls.' },
  { label: 'Contract', icon: PenTool, border: 'border-red-400/30', bg: 'bg-red-400/10', text: 'text-red-200', hover: 'hover:bg-red-400/20', prompt: 'Generate a legally-formatted contract as a self-contained web artifact. Use this sample data: Party A: Eburon AI Services, Party B: Client Corp BV. Service: AI Consulting and Software Development. Term: 12 months from today. Fee: EUR 5,000 per month payable within 15 days. Governing law: Belgium. Clauses: scope, confidentiality, IP ownership, termination 30-day notice, liability cap EUR 50,000. Include signature blocks, print CSS, and PDF-ready layout.' },
  { label: 'NDA', icon: LockKeyhole, border: 'border-rose-400/30', bg: 'bg-rose-400/10', text: 'text-rose-200', hover: 'hover:bg-rose-400/20', prompt: 'Create a professional non-disclosure agreement as a self-contained web artifact. Use this sample data: Disclosing Party: Eburon AI BV, Receiving Party: PartnerCo NV. Effective date: today. Term: 3 years. Purpose: Evaluation of potential AI partnership. Confidential info includes technical specs, business plans, customer lists. Return period: 14 days after termination. Governing law: Belgium. Include signature blocks, print/PDF controls.' },
  { label: 'Proposal', icon: BarChart3, border: 'border-amber-400/30', bg: 'bg-amber-400/10', text: 'text-amber-200', hover: 'hover:bg-amber-400/20', prompt: 'Generate a professional business proposal as a self-contained web artifact. Use this sample data: From Eburon AI to Global Retail Inc. Title: AI-Powered Customer Analytics Platform. Executive Summary: 12-week implementation to boost retention 15%. Scope: data pipeline, ML models, dashboard, API. Deliverables: Phase 1 Discovery, Phase 2 Build, Phase 3 Deploy. Timeline: 12 weeks. Pricing: EUR 45,000 fixed. Include acceptance section, print/PDF controls.' },
  { label: 'Report', icon: Presentation, border: 'border-blue-400/30', bg: 'bg-blue-400/10', text: 'text-blue-200', hover: 'hover:bg-blue-400/20', prompt: 'Create a detailed business report as a self-contained web artifact. Use this sample data: Title: Q1 2024 Sales Performance Report. Company: Eburon AI. Period: Jan-Mar 2024. Revenue: EUR 250K (+18% YoY). Top products: AI Consulting EUR 120K, SaaS Licenses EUR 80K, Training EUR 50K. Key findings: enterprise segment grew 35%, churn reduced to 4%. Recommendations: expand enterprise team, launch partner program. Include charts, tables, appendix, print/PDF controls.' },
  { label: 'Slides', icon: Cast, border: 'border-purple-400/30', bg: 'bg-purple-400/10', text: 'text-purple-200', hover: 'hover:bg-purple-400/20', prompt: 'Build an interactive slide presentation as a self-contained web artifact. Topic: Eburon AI Company Pitch. Slides: 1. Title - Eburon AI: Your Virtual Employee. 2. Problem - SMEs lack affordable AI assistants. 3. Solution - Beatrice, a voice-powered AI secretary. 4. Market - EUR 15B SME automation market. 5. Traction - 500+ users, 92% retention. 6. Team - 4 founders, ex-Google, ex-IBM. 7. Ask - EUR 500K seed round. Include animated navigation, speaker notes, print-to-PDF.' },
  { label: 'Sheet', icon: Table2, border: 'border-green-400/30', bg: 'bg-green-400/10', text: 'text-green-200', hover: 'hover:bg-green-400/20', prompt: 'Generate an interactive spreadsheet-style web artifact. Use this sample data: Employee Expense Tracker. Columns: Date, Employee, Category, Description, Amount, Status. Rows: 2024-05-01, John, Travel, Flight to London, 245.00, Approved; 2024-05-03, Sarah, Meals, Client dinner, 89.50, Pending; 2024-05-05, Mike, Office, Printer toner, 67.20, Approved. Include editable cells, sortable columns, filters, formulas for totals, CSV export.' },
  { label: 'Dashboard', icon: BarChart3, border: 'border-cyan-400/30', bg: 'bg-cyan-400/10', text: 'text-cyan-200', hover: 'hover:bg-cyan-400/20', prompt: 'Create a dashboard as a self-contained web artifact. Use this sample data: Eburon AI Operations Dashboard. KPIs: Active Users 1,247 (+12%), Revenue EUR 42.5K, Avg Session 8m 34s, Support Tickets 23. Charts: monthly revenue line chart (Jan EUR 30K to May EUR 45K), user growth bar chart, ticket resolution pie chart. Tables: top 5 clients, recent activities. Include responsive layout, export/print controls.' },
  { label: 'Diagram', icon: Code2, border: 'border-indigo-400/30', bg: 'bg-indigo-400/10', text: 'text-indigo-200', hover: 'hover:bg-indigo-400/20', prompt: 'Create a visual system architecture diagram as a self-contained web artifact using SVG. Show: User Device (mic/camera) connects to Gemini Live API, which connects to Audio Processing and Vision Processing. Vision Processing connects to Object Detection and OCR. Audio Processing connects to Speech-to-Text. All connect to a central AI Agent Core, which connects to Google Services (Gmail, Calendar, Drive) and Firebase Database. Include legend, annotations, export/print controls.' },
  { label: 'Flowchart', icon: Code2, border: 'border-sky-400/30', bg: 'bg-sky-400/10', text: 'text-sky-200', hover: 'hover:bg-sky-400/20', prompt: 'Generate a process flowchart as a self-contained web artifact with SVG. Process: Customer Onboarding. Steps: 1. Receive Inquiry (diamond: qualified?), 2. If No -> Add to Nurture List. If Yes -> 3. Send Proposal, 4. (diamond: accepted?), 5. If No -> Follow Up. If Yes -> 6. Sign Contract, 7. Setup Account, 8. Kickoff Call, 9. Handoff to Success Team. Include arrows, labels, responsive layout, export/print controls.' },
  { label: 'Timeline', icon: CalendarDays, border: 'border-orange-400/30', bg: 'bg-orange-400/10', text: 'text-orange-200', hover: 'hover:bg-orange-400/20', prompt: 'Create an interactive project timeline as a self-contained web artifact. Use this sample data: Product Launch Q3 2024. Milestones: June 1 - Design Kickoff (completed), June 15 - Prototype Review (completed), July 1 - Beta Build Start (in progress), July 20 - Internal Testing, August 5 - Beta Launch, August 20 - Marketing Campaign, September 1 - Public Launch. Include status markers, responsive layout, print/PDF controls.' },
  { label: 'Checklist', icon: Check, border: 'border-lime-400/30', bg: 'bg-lime-400/10', text: 'text-lime-200', hover: 'hover:bg-lime-400/20', prompt: 'Create an interactive checklist as a self-contained web artifact. Topic: Website Launch Preparation. Categories: Content (Write homepage copy, Create about page, Add product descriptions, Proofread all text), Technical (Set up hosting, Configure SSL, Optimize images, Test mobile responsive), Marketing (Create social accounts, Write launch post, Set up analytics, Prepare press kit), Launch Day (Final backup, Enable site, Send announcement, Monitor analytics). Include completion states, progress bar, CSV export.' },
  { label: 'Form', icon: FileText, border: 'border-fuchsia-400/30', bg: 'bg-fuchsia-400/10', text: 'text-fuchsia-200', hover: 'hover:bg-fuchsia-400/20', prompt: 'Build a polished client intake form as a self-contained web artifact. Fields: Company Name, Contact Person, Email, Phone, Industry (dropdown: Tech, Retail, Healthcare, Finance, Other), Project Type (checkboxes: Consulting, Development, Design, Training), Budget Range (radio: Under 5K, 5K-20K, 20K-50K, 50K+), Project Description (textarea), Preferred Start Date. Include validation, review screen, printable summary, export options.' },
  { label: 'Calculator', icon: Database, border: 'border-yellow-400/30', bg: 'bg-yellow-400/10', text: 'text-yellow-200', hover: 'hover:bg-yellow-400/20', prompt: 'Create a custom project pricing calculator as a self-contained web artifact. Inputs: Hourly Rate (EUR 50-200 slider), Estimated Hours (10-500), Material Cost (0-50K), Urgency Multiplier (1.0x-1.5x). Live calculations: Base Cost = Rate x Hours, Subtotal = Base + Materials, Total = Subtotal x Urgency. Example presets: Small Website (Rate 75, Hours 40, Materials 500, Urgency 1.0 = EUR 3,500), Enterprise App (Rate 125, Hours 200, Materials 5K, Urgency 1.2 = EUR 35,400). Include print/PDF layout.' },
  { label: 'Transcript', icon: Mic, border: 'border-violet-400/30', bg: 'bg-violet-400/10', text: 'text-violet-200', hover: 'hover:bg-violet-400/20', prompt: 'Create a meeting transcript workspace as a self-contained web artifact. Use this sample data: Meeting: Weekly Team Standup, Date: today, Duration: 15 min. Attendees: Alice (PM), Bob (Dev), Carol (Designer). Transcript: Alice: Good morning team, let us review sprint progress. Bob: I finished the API integration, testing today. Carol: UI mockups are ready for review. Alice: Great, any blockers? Bob: None from my side. Carol: Waiting for copy from marketing. Alice: I will follow up. Action items: 1. Bob - Complete testing by EOD, 2. Carol - Send mockups to review channel, 3. Alice - Get copy from marketing. Include editable areas, TXT/PDF export.' },
  { label: 'Minutes', icon: History, border: 'border-zinc-400/30', bg: 'bg-zinc-400/10', text: 'text-zinc-200', hover: 'hover:bg-zinc-400/20', prompt: 'Create a meeting minutes document as a self-contained web artifact. Use this sample data: Meeting: Board Strategy Session, Date: today, Location: Brussels Office. Attendees: Jo Lernout (CEO), Beatrice (Secretary), 3 Board Members. Agenda: Q3 Financial Review, New Market Expansion, Budget Allocation. Decisions: Approved EUR 200K marketing budget for Germany. Agreed to hire 2 new engineers by July 15. Selected Munich as pilot city. Action Items: Jo - Prepare investor deck by June 1 (Owner: Jo, Due: June 1), Beatrice - Schedule follow-up with German counsel (Owner: Beatrice, Due: May 25). Include PDF/print controls.' },
  { label: 'Brochure', icon: Presentation, border: 'border-pink-400/30', bg: 'bg-pink-400/10', text: 'text-pink-200', hover: 'hover:bg-pink-400/20', prompt: 'Create a modern company brochure as a self-contained web artifact. Use this sample data: Company: Eburon AI. Tagline: Your Intelligent Office Assistant. Cover: Eburon AI logo with tagline. Services: 1. Voice-Powered AI Secretary, 2. Document Automation, 3. Smart Scheduling, 4. Business Intelligence. Testimonials: "Eburon AI saved us 20 hours a week" - CFO, TechStart NV. Pricing: Starter EUR 99/mo, Pro EUR 299/mo, Enterprise custom. Contact: info@eburon.ai, +32 2 123 4567. Include call-to-action, print/PDF controls.' },
  { label: 'Certificate', icon: Check, border: 'border-emerald-400/30', bg: 'bg-emerald-400/10', text: 'text-emerald-200', hover: 'hover:bg-emerald-400/20', prompt: 'Create a professional certificate as a self-contained web artifact. Use this sample data: Title: Certificate of Completion. Recipient: Sarah Johnson. Achievement: Successfully completed Advanced AI Prompt Engineering Course. Date: today. Issuer: Eburon AI Academy. Duration: 40 hours. Grade: Distinction. Signature area: Dr. Anna De Vries, Head of Education. Decorative border, seal graphic placeholder, print/PDF controls.' },
  { label: 'Letter', icon: Mail, border: 'border-blue-400/30', bg: 'bg-blue-400/10', text: 'text-blue-200', hover: 'hover:bg-blue-400/20', prompt: 'Create a formal business letter as a self-contained web artifact. Use this sample data: Letterhead: Eburon AI Services, Rue de la Loi 100, 1040 Brussels. Date: today. Recipient: Mr. Jean Dupont, Purchasing Director, Dupont Industries NV, Avenue Louise 50, 1050 Brussels. Subject: Proposal for AI Customer Service Integration. Body: Dear Mr. Dupont, Thank you for your interest in our AI solutions. Following our conversation on May 10, I am pleased to submit this proposal... Closing: Yours sincerely, Jo Lernout, CEO. Include signature block, print/PDF controls.' },
  { label: 'Label', icon: FileText, border: 'border-stone-400/30', bg: 'bg-stone-400/10', text: 'text-stone-200', hover: 'hover:bg-stone-400/20', prompt: 'Create printable shipping labels as a self-contained web artifact. Use this sample data: Label grid 2x4 per A4 page. Fields: From: Eburon AI BV, Rue de la Loi 100, 1040 Brussels. To: TechCorp GmbH, Friedrichstrasse 100, 10117 Berlin. Weight: 2.5kg. Contents: Electronics. Fragile: Yes. Include editable fields, print-safe sizing with crop marks.' },
  { label: 'Poster', icon: PenTool, border: 'border-orange-400/30', bg: 'bg-orange-400/10', text: 'text-orange-200', hover: 'hover:bg-orange-400/20', prompt: 'Create a Canva-style event poster as a self-contained web artifact. Use this sample data: Event: Eburon AI Launch Party. Date: June 15, 2024. Time: 18:00 - 22:00. Venue: The Egg, Rue Barra 175, 1070 Brussels. Headline: Meet Beatrice - Your New AI Secretary. Subhead: Join us for drinks, demos, and the future of work. RSVP: launch@eburon.ai. Include strong visual hierarchy, placeholder for logo, responsive preview, PNG/PDF-ready output.' },
  { label: 'Export Pack', icon: Download, border: 'border-slate-400/30', bg: 'bg-slate-400/10', text: 'text-slate-200', hover: 'hover:bg-slate-400/20', prompt: 'Create a self-contained export pack interface with buttons for print, PDF-ready view, CSV, JSON, TXT, SVG, PNG, Markdown, and ZIP-style download guidance where supported client-side.' },
  { label: 'VAT Calc', icon: Calculator, border: 'border-amber-400/30', bg: 'bg-amber-400/10', text: 'text-amber-200', hover: 'hover:bg-amber-400/20', prompt: 'Create a Belgian VAT calculator as a self-contained web artifact. Use this sample data: Items: Consulting EUR 2,000, Software License EUR 500, Hosting EUR 120. Subtotal EUR 2,620. VAT 21% = EUR 550.20. Total EUR 3,170.20. Include reverse VAT calc, copy-to-clipboard, print/PDF layout, and CSV export.' },
  { label: 'Quote→Invoice', icon: FileText, border: 'border-teal-400/30', bg: 'bg-teal-400/10', text: 'text-teal-200', hover: 'hover:bg-teal-400/20', prompt: 'Create a quote-to-invoice generator as a self-contained web artifact. Use this sample data: Start with a quote to XYZ Manufacturing for EUR 15,000 + VAT 21%. Show a "Convert to Invoice" button that copies the quote data into an invoice, adds invoice number INV-Q042, sets due date +30 days, and marks the quote as accepted. Include print CSS and PDF-ready layout.' },
  { label: 'Peppol UBL', icon: Code2, border: 'border-cyan-400/30', bg: 'bg-cyan-400/10', text: 'text-cyan-200', hover: 'hover:bg-cyan-400/20', prompt: 'Create a Peppol/UBL XML invoice preview tool as a self-contained web artifact. Use this sample data: Seller: Eburon AI BV, VAT BE0400378485. Buyer: ABC Corp, VAT BE0123456789. Invoice #INV-2024-001. Total EUR 7,865. Show a clean human-readable preview of the invoice alongside a syntax-highlighted UBL XML snippet with proper tags (Invoice, AccountingSupplierParty, LegalEntityID, TaxTotal, LegalMonetaryTotal). Include copy XML and download buttons.' },
  { label: 'Contract Bldr', icon: PenTool, border: 'border-rose-400/30', bg: 'bg-rose-400/10', text: 'text-rose-200', hover: 'hover:bg-rose-400/20', prompt: 'Create an interactive contract builder as a self-contained web artifact. Use this sample data: Pre-filled fields: Party A = Eburon AI Services, Party B = Client Corp BV, Service = AI Consulting, Term = 12 months, Fee = EUR 5,000/month. Include editable clauses (scope, confidentiality, IP, termination, liability cap EUR 50,000), a live preview panel, signature placeholders, print CSS, and PDF-ready layout. Generate immediately with the sample data.' },
  { label: 'PDF Print', icon: Printer, border: 'border-neutral-400/30', bg: 'bg-neutral-400/10', text: 'text-neutral-200', hover: 'hover:bg-neutral-400/20', prompt: 'Create a universal PDF/Print export preview tool as a self-contained web artifact. Show a sample document (Eburon AI invoice) with print controls: orientation toggle, margin selector, page size (A4/Letter), scale fit, header/footer toggle, and a live print preview. Include a prominent Print and Save as PDF button. Use print CSS and make it ready for hard-copy output.' },
  { label: 'CSV XLSX', icon: ArrowUpDown, border: 'border-lime-400/30', bg: 'bg-lime-400/10', text: 'text-lime-200', hover: 'hover:bg-lime-400/20', prompt: 'Create a CSV/XLSX import-export converter as a self-contained web artifact. Use this sample data table: Employee Expenses with columns Date, Employee, Category, Amount, Status and 5 rows. Include: Upload CSV button, Download as CSV, Download as XLSX (mock), table editor with inline editing, sortable columns, and a live JSON preview of the data. Generate immediately with the sample data.' },
  { label: 'Biz Preso', icon: Presentation, border: 'border-purple-400/30', bg: 'bg-purple-400/10', text: 'text-purple-200', hover: 'hover:bg-purple-400/20', prompt: 'Create a Belgian business presentation generator as a self-contained web artifact. Topic: Eburon AI B2B Pitch for Belgian SMEs. Slides: 1. Title - Beatrice: uw AI-secretaresse. 2. Probleem - KMOs verliezen 10 uur/week aan administratie. 3. Oplossing - Spraakgestuurde AI die facturen, contracten en agenda beheert. 4. Markt - EUR 2.5B Belgische markt. 5. Resultaten - 500+ gebruikers, 92% retentie. 6. Prijs - Starter EUR 99/maand, Pro EUR 299/maand. 7. Contact - info@eburon.ai. Include animated navigation, speaker notes, print-to-PDF.' },
  { label: 'Diagram', icon: BarChart3, border: 'border-indigo-400/30', bg: 'bg-indigo-400/10', text: 'text-indigo-200', hover: 'hover:bg-indigo-400/20', prompt: 'Create a Belgian business process diagram generator as a self-contained web artifact. Topic: KMO Administratief Proces (SME Admin Process). Show a flowchart in SVG: 1. Ontvang factuur (Receive invoice) -> 2. Scan/OCR -> 3. (diamond: Geldig?) -> 4a. Nee -> Stuur terug. 4b. Ja -> Boek in boekhouding -> Controleer BTW -> Goedkeuring -> Betaal via SEPA -> Archiveren. Include Dutch labels, responsive layout, export/print controls, and legend.' },
  { label: 'Expense Rep', icon: Wallet, border: 'border-yellow-400/30', bg: 'bg-yellow-400/10', text: 'text-yellow-200', hover: 'hover:bg-yellow-400/20', prompt: 'Create a Belgian expense report generator as a self-contained web artifact. Use this sample data: Employee: Jean Dupont, Month: May 2024. Expenses: Train Brussels-Paris EUR 89, Hotel 2 nights EUR 240, Client dinner EUR 120, Taxi EUR 45, Parking EUR 18. Subtotal EUR 512. VAT 21% recoverable EUR 107.52. Total reimbursable EUR 512. Include mileage calculator at EUR 0.42/km, receipt upload placeholders, approval signature, print CSS, and CSV export.' },
  { label: 'Trans→Min', icon: BookOpen, border: 'border-sky-400/30', bg: 'bg-sky-400/10', text: 'text-sky-200', hover: 'hover:bg-sky-400/20', prompt: 'Create a transcript-to-meeting-minutes converter as a self-contained web artifact. Use this sample data transcript: Alice (PM): Welcome to the sprint review. Bob (Dev): Backend API is complete, 95% test coverage. Carol (QA): Found 3 minor UI bugs, none blocking. Alice: Great, go-live date confirmed May 20. Bob: Deployment pipeline is ready. Carol: I will prepare release notes. Auto-extract: Attendees (Alice, Bob, Carol), Decisions (go-live May 20, 95% coverage accepted), Action Items (Carol - release notes by May 18, Bob - deploy to staging May 19). Include editable transcript, editable minutes panel, TXT/PDF export.' }
];

const DOCUMENT_SHORTCUT_TONES = [
  'from-emerald-300 to-emerald-600',
  'from-lime-300 to-lime-600',
  'from-red-300 to-red-600',
  'from-amber-300 to-orange-500',
  'from-blue-300 to-blue-600',
  'from-purple-300 to-purple-600',
  'from-green-300 to-green-600',
  'from-cyan-300 to-cyan-600',
  'from-indigo-300 to-indigo-600',
  'from-sky-300 to-sky-600',
  'from-pink-300 to-pink-600',
  'from-violet-300 to-violet-600'
];

// -------------------------------------------------------------
// MAIN APP ENTRY
// -------------------------------------------------------------

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const[authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const[showAuthPassword, setShowAuthPassword] = useState(false);
  const [showAuthConfirmPassword, setShowAuthConfirmPassword] = useState(false);

  useEffect(() => {
    const fontId = 'beatrice-roboto-font';
    if (!document.getElementById(fontId)) {
      const link = document.createElement('link');
      link.id = fontId; 
      link.rel = 'stylesheet'; 
      link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap';
      document.head.appendChild(link);
    }
  },[]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        try {
          const userRef = ref(rtdb, 'users/' + u.uid);
          const userSnap = await get(userRef);
          const providerIds = u.providerData.map(provider => provider.providerId);
          const authProvider = providerIds.includes('google.com') ? 'google' : 'email';
          const hasGoogleServices = authProvider === 'google' && Boolean(localStorage.getItem('googleAccessToken'));

          if (!userSnap.exists()) {
            const initialSettings = { 
              ...DEFAULT_SETTINGS, 
              userName: u.displayName || DEFAULT_SETTINGS.userName 
            };
            
            await set(userRef, { 
              displayName: initialSettings.userName, 
              email: u.email || '', 
              authProvider, 
              googleServicesConnected: hasGoogleServices, 
              createdAt: serverTimestamp(), 
              updatedAt: serverTimestamp(), 
              settings: initialSettings 
            });
            
            setSettings(initialSettings);
          } else {
            const data = userSnap.val();
            
            if (data.settings) {
              setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
            }
            
            await update(userRef, { 
              email: u.email || data.email || '', 
              authProvider, 
              googleServicesConnected: hasGoogleServices, 
              updatedAt: serverTimestamp() 
            });
          }
        } catch (error) { 
          handleDatabaseError(error, OperationType.CREATE, 'users'); 
        }
      }
      
      setLoading(false);
    });
    
    return () => unsub();
  },[]);

  const getAuthErrorMessage = (error: any) => {
    const code = String(error?.code || '');
    
    if (code.includes('auth/email-already-in-use')) return 'That email is already registered. Sign in instead.';
    if (code.includes('auth/invalid-email')) return 'Enter a valid email address.';
    if (code.includes('auth/user-not-found') || code.includes('auth/wrong-password') || code.includes('auth/invalid-credential')) return 'Email or password is incorrect.';
    if (code.includes('auth/weak-password')) return 'Use at least 6 characters for the password.';
    if (code.includes('auth/too-many-requests')) return 'Too many attempts. Wait a moment and try again.';
    if (code.includes('auth/popup-closed-by-user')) return 'The Google sign-in window was closed.';
    
    return error?.message || 'Authentication failed. Try again.';
  };

  const handleGoogleLogin = async () => {
    setAuthBusy(true); 
    setAuthMessage(null);
    
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ 
        prompt: 'consent select_account', 
        access_type: 'offline' 
      });
      
      provider.addScope('https://www.googleapis.com/auth/gmail.modify'); 
      provider.addScope('https://www.googleapis.com/auth/gmail.send'); 
      provider.addScope('https://www.googleapis.com/auth/gmail.compose');
      provider.addScope('https://www.googleapis.com/auth/drive'); 
      provider.addScope('https://www.googleapis.com/auth/documents'); 
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      provider.addScope('https://www.googleapis.com/auth/presentations'); 
      provider.addScope('https://www.googleapis.com/auth/youtube'); 
      provider.addScope('https://www.googleapis.com/auth/calendar');
      provider.addScope('https://www.googleapis.com/auth/tasks'); 
      provider.addScope('https://www.googleapis.com/auth/contacts.readonly'); 
      provider.addScope('https://www.googleapis.com/auth/forms.body');
      provider.addScope('https://www.googleapis.com/auth/chat.messages'); 
      provider.addScope('https://www.googleapis.com/auth/analytics.readonly');
      
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential?.accessToken) {
        localStorage.setItem('googleAccessToken', credential.accessToken);
      }
    } catch (error: any) {
      if (error && error.message && error.message.includes('missing initial state')) {
        setAuthMessage({ 
          type: 'error', 
          text: "Authentication failed due to browser privacy settings. Open the app in a new tab and try again." 
        });
      } else {
        setAuthMessage({ 
          type: 'error', 
          text: getAuthErrorMessage(error) 
        });
      }
    } finally { 
      setAuthBusy(false); 
    }
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); 
    setAuthBusy(true); 
    setAuthMessage(null);
    
    const email = authEmail.trim(); 
    const password = authPassword.trim(); 
    const fullName = authName.trim();
    
    try {
      if (!email) {
        throw new Error('Enter your email address.');
      }
      
      if (authMode === 'reset') { 
        await sendPasswordResetEmail(auth, email); 
        setAuthMessage({ type: 'success', text: 'Password reset email sent. Check your inbox.' }); 
        setAuthMode('signin'); 
        return; 
      }
      
      if (!password) {
        throw new Error('Enter your password.');
      }
      
      if (authMode === 'signup') {
        if (!fullName) throw new Error('Enter your full name.');
        if (password.length < 6) throw new Error('Use at least 6 characters for the password.');
        if (password !== authConfirmPassword.trim()) throw new Error('Passwords do not match.');
        
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: fullName });
        localStorage.removeItem('googleAccessToken');
        return;
      }
      
      await signInWithEmailAndPassword(auth, email, password); 
      localStorage.removeItem('googleAccessToken');
    } catch (error: any) { 
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) }); 
    } finally { 
      setAuthBusy(false); 
    }
  };

  const handleLogout = () => { 
    localStorage.removeItem('googleAccessToken'); 
    signOut(auth); 
  };

  if (loading) {
    return ( 
      <div className="flex min-h-screen items-center justify-center bg-[#020203] text-zinc-500">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="animate-pulse text-[10px] uppercase tracking-widest">Preparing VEP...</p>
        </div>
      </div> 
    );
  }

  if (!user) {
    const isSignUp = authMode === 'signup'; 
    const isReset = authMode === 'reset';
    const authTitle = isSignUp ? 'Register' : isReset ? 'Reset password' : 'Welcome';
    const authSubtitle = isSignUp ? 'Create your new account' : isReset ? 'Send a reset link to your email' : 'Login to your account';

    return (
      <div className="relative min-h-[100dvh] overflow-hidden bg-[#050505] text-white" style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(190,242,100,0.13),transparent_34%),linear-gradient(180deg,#050505,#020302)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <motion.main 
          key={authMode} 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2, ease: 'easeOut' }} 
          className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-6 pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))]"
        >
          <section className="flex flex-1 flex-col justify-center py-10">
            <div className="mb-9 flex flex-col items-center text-center">
              <img src={EBURON_LOGO_URL} alt="Eburon" className="mb-8 h-24 w-24 rounded-full object-cover shadow-[0_0_70px_rgba(190,242,100,0.16)]" />
              <h1 className="text-[44px] font-bold leading-none tracking-[-0.05em] text-white">{authTitle}</h1>
              <p className="mt-2 text-sm text-zinc-500">{authSubtitle}</p>
            </div>
            
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {isSignUp && ( 
                <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 focus-within:border-lime-300/40">
                  <UserRound className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input 
                    value={authName} 
                    onChange={(e) => setAuthName(e.target.value)} 
                    placeholder="Full name" 
                    autoComplete="name" 
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600" 
                  />
                </label> 
              )}
              
              <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 focus-within:border-lime-300/40">
                <Mail className="h-4 w-4 shrink-0 text-zinc-500" />
                <input 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)} 
                  type="email" 
                  placeholder="Email" 
                  autoComplete="email" 
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600" 
                />
              </label>
              
              {!isReset && ( 
                <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 focus-within:border-lime-300/40">
                  <LockKeyhole className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input 
                    value={authPassword} 
                    onChange={(e) => setAuthPassword(e.target.value)} 
                    type={showAuthPassword ? 'text' : 'password'} 
                    placeholder="Password" 
                    autoComplete={isSignUp ? 'new-password' : 'current-password'} 
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowAuthPassword(v => !v)} 
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                  >
                    {showAuthPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {!isSignUp && ( 
                    <button 
                      type="button" 
                      onClick={() => { setAuthMode('reset'); setAuthMessage(null); }} 
                      className="text-xs font-bold text-lime-200"
                    >
                      Forgot?
                    </button> 
                  )}
                </label> 
              )}
              
              {isSignUp && ( 
                <label className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 focus-within:border-lime-300/40">
                  <LockKeyhole className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input 
                    value={authConfirmPassword} 
                    onChange={(e) => setAuthConfirmPassword(e.target.value)} 
                    type={showAuthConfirmPassword ? 'text' : 'password'} 
                    placeholder="Confirm password" 
                    autoComplete="new-password" 
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowAuthConfirmPassword(v => !v)} 
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                  >
                    {showAuthConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </label> 
              )}
              
              {authMessage && ( 
                <div 
                  className={`rounded-2xl px-4 py-3 text-xs leading-5 ${
                    authMessage.type === 'error' 
                      ? 'border border-red-400/20 bg-red-500/10 text-red-200' 
                      : authMessage.type === 'success' 
                        ? 'border border-lime-300/20 bg-lime-300/10 text-lime-100' 
                        : 'border border-white/10 bg-white/[0.06] text-zinc-300'
                  }`}
                >
                  {authMessage.text}
                </div> 
              )}
              
              <button 
                type="submit" 
                disabled={authBusy} 
                className="mt-7 flex h-14 w-full items-center justify-center rounded-full bg-lime-300 text-sm font-bold text-black shadow-[0_18px_48px_rgba(190,242,100,0.18)] transition active:scale-[0.985] disabled:opacity-60"
              >
                {authBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : isReset ? 'Send reset link' : isSignUp ? 'Sign up' : 'Sign in'}
              </button>
              
              {!isReset && ( 
                <>
                  <div className="flex items-center gap-3 py-1.5">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs font-medium text-zinc-600">or</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  
                  <button 
                    type="button" 
                    onClick={handleGoogleLogin} 
                    disabled={authBusy} 
                    className="flex h-14 w-full items-center justify-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-5 text-sm font-bold text-zinc-100 transition hover:border-lime-300/30 hover:bg-lime-300/10 active:scale-[0.985] disabled:opacity-60"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-base font-black text-black">G</span>
                    Continue with Google
                  </button>
                </> 
              )}
            </form>
          </section>
          
          <footer className="text-center text-sm text-zinc-500">
            {isSignUp ? 'Back to ' : isReset ? 'Remembered it? ' : 'Create account? '}
            <button 
              type="button" 
              onClick={() => { setAuthMode(isSignUp || isReset ? 'signin' : 'signup'); setAuthMessage(null); }} 
              className="font-bold text-lime-200"
            >
              {isSignUp || isReset ? 'Sign in' : 'Sign up'}
            </button>
          </footer>
        </motion.main>
      </div>
    );
  }

  return <BeatriceAgent user={user} onLogout={handleLogout} initialSettings={settings} />;
}

// -------------------------------------------------------------
// CORE BEATRICE AGENT ENGINE
// -------------------------------------------------------------

function BeatriceAgent({ 
  user, 
  onLogout, 
  initialSettings 
}: { 
  user: User; 
  onLogout: () => void; 
  initialSettings: AgentSettings; 
}) {
  const [isActive, setIsActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const[micBands, setMicBands] = useState<number[]>(Array(20).fill(0));
  const[speakerLevel, setSpeakerLevel] = useState(0);
  const [speakerBands, setSpeakerBands] = useState<number[]>(Array(20).fill(0));
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [activeTaskPage, setActiveTaskPage] = useState<ActionTask | null>(null);
  const [historyContext, setHistoryContext] = useState<string>('');
  const[historyMsgs, setHistoryMsgs] = useState<ChatMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<{ role: 'user' | 'model'; text: string } | null>(null);

  const[isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showMeetingRecorder, setShowMeetingRecorder] = useState(false);
  const [livePreview, setLivePreview] = useState<{ data: string; filename: string } | null>(null);
  const [showToolConfirm, setShowToolConfirm] = useState(false);
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [imageToAnalyze, setImageToAnalyze] = useState<{ dataUrl: string; fileName: string } | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [settings, setSettings] = useState<AgentSettings>({ ...DEFAULT_SETTINGS, ...initialSettings });

  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);

  const transcriptTimeoutRef = useRef<any>(null);
  const isMutedRef = useRef(false);
  const isActiveRef = useRef(false);
  const micAnimationFrameRef = useRef<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const knowledgeBaseInputRef = useRef<HTMLInputElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const modelTranscriptBufferRef = useRef('');
  const userTranscriptBufferRef = useRef('');
  const lastSavedModelTranscriptRef = useRef('');
  const lastSavedUserTranscriptRef = useRef('');
  const isAgentSpeakingRef = useRef(false);
  const silenceTimerRef = useRef<any>(null);
  const recentSilencePromptsRef = useRef<Set<string>>(new Set());
  const pendingToolCallsRef = useRef<any[]>([]);
  const pendingToolConfirmRef = useRef(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    isAgentSpeakingRef.current = isAgentSpeaking;
  }, [isAgentSpeaking]);

  useEffect(() => {
    if (!isActive) {
      setSessionTimer(0);
      return;
    }
    const interval = setInterval(() => setSessionTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [historyMsgs, currentTranscript]);

  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => { 
      try { 
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen'); 
        }
      } catch (err) {} 
    };
    
    if (isActive) {
      requestWakeLock();
    }
    
    return () => { 
      if (wakeLock) {
        wakeLock.release().catch(() => {}); 
      }
    };
  }, [isActive]);

  useEffect(() => {
    const historyRef = query(ref(rtdb, 'users/' + user.uid + '/messages'), orderByChild('timestamp'), limitToLast(160));
    
    const unsub = onValue(historyRef, (snap) => {
      const msgs: string[] =[]; 
      const rawMsgs: ChatMessage[] =[];
      
      snap.forEach(child => { 
        const m = child.val() as ChatMessage; 
        msgs.push(`${m.role.toUpperCase()}: ${m.text}`); 
        rawMsgs.push(m); 
      });
      
      setHistoryMsgs(rawMsgs);
      
      if (msgs.length > 0) {
        setHistoryContext('Previous conversation for context memory:\n' + msgs.slice(-36).join('\n'));
      } else {
        setHistoryContext('');
      }
    });
    
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) {
      aiRef.current = new GoogleGenAI({ apiKey });
    }
    
    audioStreamerRef.current = new AudioStreamer();
    
    return () => { 
      unsub(); 
      stopSession(); 
    };
  }, [user.uid]);

  const selectedVoiceMeta = useMemo(() => {
    return GEMINI_LIVE_VOICE_OPTIONS.find(v => v.id === settings.selectedVoice) || GEMINI_LIVE_VOICE_OPTIONS[0];
  },[settings.selectedVoice]);

  const referenceShortcuts = useMemo(() => [
    ...DOCUMENT_SKILLS.map((skill, index) => ({
      label: skill.label,
      icon: skill.icon,
      tone: DOCUMENT_SHORTCUT_TONES[index % DOCUMENT_SHORTCUT_TONES.length],
      prompt: skill.prompt,
    })),
    { label: 'Image', icon: Image, tone: 'from-pink-400 to-pink-600', prompt: 'Generate a stunning professional image for me based on your creative interpretation. Enhance my idea with professional photography techniques, lighting, and composition.' },
    { label: 'Video', icon: Film, tone: 'from-purple-400 to-purple-600', prompt: 'Create a professional 12-second product showcase video using KIE AI. Make it cinematic with smooth camera movements, professional lighting, and commercial-quality output.' },
    { label: 'AI Video', icon: Video, tone: 'from-cyan-400 to-cyan-600', prompt: 'Create a professional AI-powered video with avatar narration using HeyGen. Make it polished with appropriate tone and visual style for the topic.' },
    { label: 'Art', icon: Palette, tone: 'from-orange-400 to-orange-600', prompt: 'Enhance my creative prompt and generate amazing AI art. Create something visually stunning with artistic flair and professional execution.' },
    { label: 'Calendar', icon: CalendarDays, tone: 'from-sky-400 to-cyan-300', prompt: 'Use the execute_google_service function now with serviceName: Calendar, action: list, details: {}. Show the result on screen and tell me naturally what is coming up.' },
    { label: 'Drive', icon: FolderOpen, tone: 'from-blue-400 to-blue-600', prompt: 'Use the execute_google_service function now with serviceName: Drive, action: search, details: { query: invoice }. Show matching files and summarize them.' },
    { label: 'Google', icon: Search, tone: 'from-white to-zinc-200 text-blue-500', prompt: 'Check my Google service authorization status and reconnect permissions if required before using Gmail, Calendar, Drive, Sheets, Slides, or Tasks.' },
    { label: 'Sign', icon: PenTool, tone: 'from-red-400 to-red-600', prompt: 'Create a Belgian-ready signature and contract signing checklist for a supplier services contract. Show the practical result.' },
    { label: 'Company', icon: Building2, tone: 'from-blue-500 to-indigo-700', prompt: 'Run a Belgian company lookup for BE0400378485 and show the official verification result.' },
    { label: 'History', icon: History, tone: 'from-zinc-400 to-zinc-700', prompt: 'Open and summarize the recent conversation and task history.' },
    { label: 'Mail', icon: Mail, tone: 'from-red-400 to-red-600', prompt: 'Use the execute_google_service function now with serviceName: Gmail, action: search, details: { query: invoice OR contract newer_than:30d }. Show useful recent messages.' },
    { label: 'Sheets', icon: Table2, tone: 'from-green-300 to-green-600', prompt: 'Use the execute_google_service function now with serviceName: Sheets, action: list, details: {}. Show my available spreadsheets.' },
    { label: 'Slides', icon: Presentation, tone: 'from-orange-300 to-orange-600', prompt: 'Use the execute_google_service function now with serviceName: Slides, action: list, details: {}. Show my presentations.' },
    { label: 'Docs', icon: FileText, tone: 'from-emerald-400 to-emerald-600', prompt: 'Create a sample multi-purpose document starter pack as a self-contained web artifact. Include: 1. A Belgian invoice sample (seller Eburon AI, buyer Sample Corp, total EUR 5,000 + VAT), 2. A one-page contract template (parties, scope, 12-month term), 3. A meeting minutes template (agenda, attendees, decisions, action items). Make all sections editable and include print CSS and PDF-ready layout. Do not ask the user for details — generate the complete sample pack now.' },
    { label: 'Skills', icon: Settings, tone: 'from-purple-400 to-purple-600', prompt: '' },
    { label: 'Profile', icon: UserRound, tone: 'from-indigo-400 to-indigo-600', prompt: '' },
    { label: 'Settings', icon: Settings, tone: 'from-zinc-400 to-zinc-600', prompt: '' },
  ], []);

  const reverseReferenceShortcuts = useMemo(() => [...referenceShortcuts].reverse(), [referenceShortcuts]);

  const runReferenceShortcut = async (label: string, prompt: string) => {
    if (label === 'Skills') {
      setShowSkills(true);
      setActiveTaskPage(null);
      return;
    }
    if (label === 'Profile') {
      setShowProfile(true);
      setActiveTaskPage(null);
      return;
    }
    if (label === 'Settings') {
      setShowSettings(true);
      setActiveTaskPage(null);
      return;
    }
    if (activeTaskPage?.status === 'processing') {
      return;
    }
    const tid = `shortcut-${Date.now()}`;
    const task: ActionTask = {
      id: tid,
      serviceName: label,
      action: prompt,
      status: 'processing',
      result: `${settings.agentName} is handling this now through the live audio session.`,
    };

    setActiveTaskPage(task);
    setTasks(p => [task, ...p.filter(t => t.status === 'processing').slice(0, 2)]);

    try {
      // Ensure Live session is active so the model can narrate results
      if (!sessionRef.current) {
        await startSession();
        await new Promise(resolve => setTimeout(resolve, 900));
      }

      // Tell Live model to acknowledge — the worker will do the actual work
      if (sessionRef.current) {
        sendTurnToLive(`${settings.userName} tapped the "${label}" button. Say "OK, I'll get that started right away" warmly, then keep the conversation going naturally while the system works in the background.`);
      }

      // Run the actual work through the worker agent
      await runWorkerAgent(prompt, label);
    } catch (err: any) {
      const result = String(err?.message || err);
      setActiveTaskPage(prev => prev && prev.id === tid ? { ...prev, status: 'failed', result } : prev);
      setTasks(p => p.map(t => t.id === tid ? { ...t, status: 'failed', result } : t));
    }
  };

  const buildResumePrompt = (msgs: ChatMessage[]): string => {
    if (msgs.length === 0) {
      return `${settings.userName} is here in the office. Say one brief natural sentence to acknowledge their presence — no "What's first?", no "What can I do for you?", no "How can I help?". Just a normal human remark, then stop.`;
    }
    const recent = msgs.slice(-8);
    const summary = recent.map(m => `${m.role === 'user' ? settings.userName : settings.agentName}: ${m.text}`).join('\n');
    return `${settings.userName} is here in the office. Resume the conversation naturally from where you left off, as if no time has passed. Here is the recent context:\n\n${summary}\n\nPick up the thread from the LAST topic above. Do NOT start with any generic greeting or opener. ABSOLUTELY FORBIDDEN phrases: "What's first?", "What's first on the desk?", "What are we doing first?", "What can I do for you?", "How can I help?", "Hello", "Good morning", "I'm here" as a standalone greeting. Just continue the last topic or ask one brief natural follow-up about it. Speak like a normal human colleague who remembers the last thing you discussed. Then stop.`;
  };

  const saveMessage = (role: 'user' | 'model', text: string, extra?: Partial<ChatMessage>) => {
    const clean = text.trim(); 
    if (!clean && !extra?.fileDataUrl) return;
    
    try { 
      const msgRef = push(ref(rtdb, 'users/' + user.uid + '/messages')); 
      set(msgRef, { role, text: clean, timestamp: Date.now(), ...extra }); 
    } catch (e) { 
      console.error(e); 
    }
  };

  const saveModelBuffer = () => {
    const clean = modelTranscriptBufferRef.current.trim();
    if (!clean || clean === lastSavedModelTranscriptRef.current) return;
    
    lastSavedModelTranscriptRef.current = clean;
    saveMessage('model', clean);
    setActiveTaskPage(prev => prev && prev.status === 'processing' ? { ...prev, status: 'completed', result: clean } : prev);
    modelTranscriptBufferRef.current = '';

    if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
    setCurrentTranscript(null);
  };

  const saveUserBuffer = () => {
    const clean = userTranscriptBufferRef.current.trim();
    if (!clean || clean === lastSavedUserTranscriptRef.current) return;
    
    lastSavedUserTranscriptRef.current = clean; 
    saveMessage('user', clean);
    userTranscriptBufferRef.current = '';

    if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
    setCurrentTranscript(null);
  };

  const updateLiveTranscript = (role: 'user' | 'model', text: string, clearDelay = 3900) => {
    const clean = text.trim();
    if (!clean) return;

    setCurrentTranscript({ role, text: clean });

    if (transcriptTimeoutRef.current) {
      clearTimeout(transcriptTimeoutRef.current);
    }

    transcriptTimeoutRef.current = setTimeout(() => {
      setCurrentTranscript(null);
    }, clearDelay);
  };

  const startMicVisualizer = () => {
    const tick = () => {
      const recorder: any = audioRecorderRef.current; 
      const streamer: any = audioStreamerRef.current;
      
      let nextLevel = 0; 
      let nextBands = Array(20).fill(0); 
      let nextSpeakerLevel = 0; 
      let nextSpeakerBands = Array(20).fill(0);
      
      try {
        if (recorder && typeof recorder.getFrequencyBands === 'function') {
          const bands = recorder.getFrequencyBands(20) ||[]; 
          nextBands = bands.map((n: number) => Math.min(1, Math.max(0, Number(n || 0))));
          const frequencyAverage = nextBands.reduce((sum: number, n: number) => sum + n, 0) / Math.max(nextBands.length, 1);
          const recorderLevel = typeof recorder.getLevel === 'function' ? recorder.getLevel() : 0;
          nextLevel = Math.min(1, Math.max(recorderLevel, frequencyAverage * 1.8));
        } else if (isActiveRef.current && !isMutedRef.current) { 
          nextLevel = 0.06; 
          nextBands = Array(20).fill(0.04); 
        }
      } catch (e) { 
        nextLevel = 0; 
        nextBands = Array(20).fill(0); 
      }
      
      try {
        if (streamer && typeof streamer.getFrequencyBands === 'function') {
          const bands = streamer.getFrequencyBands(20) ||[]; 
          nextSpeakerBands = bands.map((n: number) => Math.min(1, Math.max(0, Number(n || 0))));
          const frequencyAverage = nextSpeakerBands.reduce((sum: number, n: number) => sum + n, 0) / Math.max(nextSpeakerBands.length, 1);
          const streamerLevel = typeof streamer.getLevel === 'function' ? streamer.getLevel() : 0;
          nextSpeakerLevel = Math.min(1, Math.max(streamerLevel, frequencyAverage * 1.65));
        }
      } catch (e) { 
        nextSpeakerLevel = 0; 
        nextSpeakerBands = Array(20).fill(0); 
      }
      
      if (isMutedRef.current || !isActiveRef.current) { 
        nextLevel = 0; 
        nextBands = Array(20).fill(0); 
      }
      
      if (!isActiveRef.current) { 
        nextSpeakerLevel = 0; 
        nextSpeakerBands = Array(20).fill(0); 
      }
      
      setMicLevel(prev => prev + (nextLevel - prev) * 0.46); 
      setMicBands(prev => nextBands.map((band: number, i: number) => prev[i] + (band - prev[i]) * 0.42));
      
      setSpeakerLevel(prev => prev + (nextSpeakerLevel - prev) * 0.5); 
      setSpeakerBands(prev => nextSpeakerBands.map((band: number, i: number) => prev[i] + (band - prev[i]) * 0.48));
      
      micAnimationFrameRef.current = requestAnimationFrame(tick);
    };
    
    if (micAnimationFrameRef.current) {
      cancelAnimationFrame(micAnimationFrameRef.current);
    }
    
    micAnimationFrameRef.current = requestAnimationFrame(tick);
  };

  const stopMicVisualizer = () => {
    if (micAnimationFrameRef.current) {
      cancelAnimationFrame(micAnimationFrameRef.current);
    }
    micAnimationFrameRef.current = null; 
    setMicLevel(0); 
    setMicBands(Array(20).fill(0)); 
    setSpeakerLevel(0); 
    setSpeakerBands(Array(20).fill(0));
  };

  const sendTextToLive = (text: string) => {
    if (sessionRef.current && typeof sessionRef.current.sendRealtimeInput === 'function') {
      sessionRef.current.sendRealtimeInput({ text });
    }
  };

  const sendTurnToLive = (text: string) => {
    if (sessionRef.current && typeof sessionRef.current.sendClientContent === 'function') {
      sessionRef.current.sendClientContent({
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      });
    }
  };

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const scheduleSilenceCheck = () => {
    clearSilenceTimer();
    if (!isActiveRef.current || isMutedRef.current) return;
    silenceTimerRef.current = setTimeout(() => {
      if (!isActiveRef.current || isAgentSpeakingRef.current) return;
      sendSilencePrompt();
    }, 8000);
  };

  const sendSilencePrompt = () => {
    if (!isActiveRef.current || isAgentSpeakingRef.current) return;
    const pool = SILENCE_PROMPTS(settings.agentName, settings.userName);
    const available = pool.filter(p => !recentSilencePromptsRef.current.has(p));
    const candidates = available.length > 0 ? available : pool;
    if (available.length === 0) recentSilencePromptsRef.current.clear();
    const prompt = candidates[Math.floor(Math.random() * candidates.length)];
    recentSilencePromptsRef.current.add(prompt);
    if (recentSilencePromptsRef.current.size > 6) {
      const first = recentSilencePromptsRef.current.values().next().value;
      if (first) recentSilencePromptsRef.current.delete(first);
    }
    sendTextToLive(prompt);
  };

  const sendAudioToLive = (base64: string) => { 
    if (sessionRef.current && typeof sessionRef.current.sendRealtimeInput === 'function') {
      sessionRef.current.sendRealtimeInput({ 
        audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } 
      }); 
    }
  };
  
  const sendVideoToLive = (base64Data: string) => {
    if (sessionRef.current && typeof sessionRef.current.sendRealtimeInput === 'function') {
      sessionRef.current.sendRealtimeInput({
        video: { data: base64Data, mimeType: 'image/jpeg' }
      });
    }
  };

  const executePendingTools = async () => {
    const calls = pendingToolCallsRef.current;
    if (!calls.length || !sessionRef.current) return;

    pendingToolConfirmRef.current = false;
    setShowToolConfirm(false);

    const resps: any[] = [];

    for (const c of calls) {
      const toolName = c.name || 'unknown_tool';
      const args = c.args as any;
      const tid = Math.random().toString(36).substring(7);

      const taskPage: ActionTask = {
        id: tid,
        serviceName: toolName,
        action: safeJsonStringify(args || {}),
        status: 'processing',
        result: `${settings.agentName} is working on this now.`,
      };
      setActiveTaskPage(taskPage);
      setTasks(p => [taskPage, ...p.filter(t => t.status === 'processing').slice(0, 2)]);

      try {
        const result = await executeGoogleTool(toolName, args);
        const download = result.downloadData && result.downloadFilename
          ? {
              downloadData: result.downloadData,
              downloadFilename: result.downloadFilename,
              htmlPreviewData: result.htmlPreviewData,
              htmlPreviewFilename: result.htmlPreviewFilename
            }
          : makeDownloadFile(result, toolName);

        const completedTask = {
          id: tid,
          serviceName: toolName,
          action: safeJsonStringify(args || {}),
          status: 'completed' as const,
          result: result.note || result.summary || `Completed: ${toolName}`,
          ...download,
        };
        setActiveTaskPage(completedTask);
        setTasks(p => p.map(t => t.id === tid ? completedTask : t));

        resps.push({
          id: c.id,
          name: toolName,
          response: {
            result,
            downloadFilename: download.downloadFilename
          }
        });
      } catch (err: any) {
        const result = {
          toolName,
          args,
          status: 'failed',
          error: String(err?.message || err),
          executedAt: new Date().toISOString()
        };
        const download = makeDownloadFile(result, `${toolName}-error`);

        const failedTask = {
          id: tid,
          serviceName: toolName,
          action: safeJsonStringify(args || {}),
          status: 'failed' as const,
          result: result.error,
          ...download,
        };
        setActiveTaskPage(failedTask);
        setTasks(p => p.map(t => t.id === tid ? failedTask : t));

        resps.push({ id: c.id, name: toolName, response: result });
      }
    }

    pendingToolCallsRef.current = [];

    // The original tool call was already resolved with a fake response to keep the model talking.
    // Now send the real results as a text message so the model can narrate them naturally.
    if (resps.length > 0 && sessionRef.current) {
      const summaries = resps.map((r: any) => {
        const name = r.name || 'task';
        const ok = r.response?.result && !r.response?.error;
        const summary = r.response?.result?.summary || r.response?.result?.note || (ok ? 'done' : 'failed');
        return `${name}: ${summary}`;
      }).join('; ');

      sendTurnToLive(`The tasks finished. Results: ${summaries}. Tell ${settings.userName} briefly and naturally what was accomplished — no technical jargon, just a normal colleague update.`);
    }
  };

  const cancelPendingTools = () => {
    pendingToolCallsRef.current = [];
    pendingToolConfirmRef.current = false;
    setShowToolConfirm(false);
    if (sessionRef.current) {
      sendTurnToLive(`The user cancelled the action. Acknowledge briefly and normally, then stop.`);
    }
  };

  // -------------------------------------------------------------
  // WORKER AGENT — non-Live model that handles all tool execution
  // The Live Audio model is conversational-only. All actual work
  // is routed through this worker, then results are narrated by Live.
  // -------------------------------------------------------------
  const runWorkerAgent = async (prompt: string, label?: string) => {
    if (!aiRef.current) throw new Error('AI not initialized');

    const tid = `worker-${Date.now()}`;
    const task: ActionTask = {
      id: tid,
      serviceName: label || 'Task',
      action: prompt,
      status: 'processing',
      result: `${settings.agentName} is working on this now.`,
    };
    setActiveTaskPage(task);
    setTasks(p => [task, ...p.filter(t => t.status === 'processing').slice(0, 2)]);

    try {
      const response = await aiRef.current.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ functionDeclarations: [...GOOGLE_SERVICE_TOOLS, ...KIE_TOOLS, ...HEYGEN_TOOLS] }],
          systemInstruction: `You are ${settings.agentName}, an executive assistant. Execute the user's request using available tools. Build HTML artifacts when possible. Return a brief, natural summary of what was accomplished.`,
        },
      });

      let finalResult: any = {};
      const completedTools: string[] = [];

      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          const result = await executeGoogleTool(call.name, call.args);
          completedTools.push(result.note || result.summary || call.name);
          if (result.htmlPreviewData || result.downloadData) {
            finalResult = { ...finalResult, ...result };
          }
        }
      }

      if (response.text) {
        finalResult.note = response.text;
      }

      const completedTask = {
        ...task,
        status: 'completed' as const,
        result: finalResult.note || finalResult.summary || `Done`,
        downloadData: finalResult.downloadData,
        downloadFilename: finalResult.downloadFilename,
        htmlPreviewData: finalResult.htmlPreviewData,
        htmlPreviewFilename: finalResult.htmlPreviewFilename,
      };
      setActiveTaskPage(completedTask);
      setTasks(p => p.map(t => t.id === tid ? completedTask : t));

      // Save to history
      saveMessage('model', completedTask.result, {
        toolName: label || 'worker',
        toolResult: finalResult,
        downloadData: finalResult.downloadData,
        downloadFilename: finalResult.downloadFilename,
        htmlPreviewData: finalResult.htmlPreviewData,
        htmlPreviewFilename: finalResult.htmlPreviewFilename,
      });

      // Notify Live model to narrate results
      if (sessionRef.current) {
        const summary = completedTools.length > 0
          ? `Done. I completed: ${completedTools.join(', ')}. Tell ${settings.userName} briefly and naturally what was accomplished — no technical jargon, just a normal colleague update.`
          : `Done. ${finalResult.note || 'The task is complete.'} Tell ${settings.userName} briefly and naturally.`;
        sendTurnToLive(summary);
      }

      return finalResult;
    } catch (err: any) {
      const failedTask = {
        ...task,
        status: 'failed' as const,
        result: String(err?.message || err),
      };
      setActiveTaskPage(failedTask);
      setTasks(p => p.map(t => t.id === tid ? failedTask : t));

      if (sessionRef.current) {
        sendTurnToLive(`Something went wrong: ${failedTask.result}. Tell ${settings.userName} briefly that something went wrong and apologize normally.`);
      }

      throw err;
    }
  };

  const sendChatMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const clean = chatInput.trim();
    if (!clean) return;

    setChatInput('');

    try {
      if (!sessionRef.current) {
        await startSession();
        await new Promise(resolve => setTimeout(resolve, 900));
      }

      if (sessionRef.current) {
        // Non-negotiable transcript rule: typed text is sent into Gemini Live Audio,
        // but it is not manually inserted into the visible conversation window.
        // The visible user/AI transcript is populated only from Gemini Live Audio
        // inputAudioTranscription/outputAudioTranscription events.
        sendTurnToLive(clean);
      }
    } catch (err) {
      console.error('Could not send chat message to Live Audio:', err);
    }
  };

  const googleFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('googleAccessToken');
    if (!token) throw new Error('No access token. Reconnect permissions from Profile.');
    
    const res = await fetch(url, { 
      ...options, 
      headers: { 
        Authorization: `Bearer ${token}`, 
        ...(options.headers || {}) 
      } 
    });
    
    if (!res.ok) { 
      const text = await res.text().catch(() => ''); 
      throw new Error(`Service API error ${res.status}: ${text || res.statusText}`); 
    }
    
    return res;
  };

  const googleJson = async (url: string, options: RequestInit = {}) => {
    const res = await googleFetch(url, { 
      ...options, 
      headers: { 
        'Content-Type': 'application/json', 
        ...(options.headers || {}) 
      } 
    });
    return res.json();
  };

  const getCurrentUserEmail = () => user.email || '';

  const searchDriveFirst = async (q: string) => {
    const escaped = q.replace(/'/g, "\\'");
    const result = await googleJson(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name contains '${escaped}' and trashed = false`)}&fields=files(id,name,mimeType,webViewLink,webContentLink,modifiedTime)&pageSize=1`
    );
    return result.files?.[0] || null;
  };

  const createGoogleDoc = async (title: string, content: string) => {
    const doc = await googleJson('https://docs.googleapis.com/v1/documents', { 
      method: 'POST', 
      body: JSON.stringify({ title }) 
    });
    
    if (content?.trim()) {
      await googleJson(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, { 
        method: 'POST', 
        body: JSON.stringify({ 
          requests:[
            { 
              insertText: { 
                location: { index: 1 }, 
                text: content 
              } 
            }
          ] 
        }) 
      });
    }
    
    const file = await googleJson(`https://www.googleapis.com/drive/v3/files/${doc.documentId}?fields=id,name,mimeType,webViewLink`);
    
    return { ...doc, driveFile: file };
  };

  const exportDriveFile = async (fileId: string, mimeType: string) => {
    const res = await googleFetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`);
    return res.blob();
  };

  const uploadTextFileToDrive = async (fileName: string, content: string, mimeType = 'text/plain', folderId?: string) => {
    const metadata: any = { name: fileName }; 
    if (folderId) metadata.parents =[folderId];
    
    const boundary = `boundary_${Date.now()}`;
    const multipartBody = 
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n` +
      `${content || ''}\r\n` +
      `--${boundary}--`;
      
    return googleFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink', { 
      method: 'POST', 
      headers: { 
        'Content-Type': `multipart/related; boundary=${boundary}` 
      }, 
      body: multipartBody 
    }).then(r => r.json());
  };

  const sendGmail = async ({ to, subject, body, cc, bcc, attachment }: any) => {
    const raw = buildEmailRaw({ to, subject, body, cc, bcc, attachment });
    return googleJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { 
      method: 'POST', 
      body: JSON.stringify({ raw }) 
    });
  };

  const executeGoogleTool = async (toolName: string, args: any) => {
    const executedAt = new Date().toISOString();

    const handleDocumentGeneration = async (html: string, defaultTitle: string) => {
        const title = args.title || args.meetingTitle || (args.invoiceNumber ? `Invoice ${args.invoiceNumber}` : defaultTitle);
        const htmlFile = makeHtmlArtifactFile(html, `${title}.html`);
        
        let driveFile: any = null; 
        let emailResult: any = null;
        const emailTo = args.emailTo === 'current_user' ? getCurrentUserEmail() : args.emailTo;
        
        if (args.saveToDrive) {
          driveFile = await uploadTextFileToDrive(htmlFile.htmlPreviewFilename, htmlFile.html, 'text/html');
        }

        if (emailTo) {
            emailResult = await sendGmail({
                to: emailTo, 
                subject: title, 
                body: `Attached is the generated document: ${title}. Please open the HTML file in your browser to view or print as PDF.`,
                attachment: { 
                  filename: htmlFile.htmlPreviewFilename, 
                  mimeType: 'text/html', 
                  base64Content: btoa(unescape(encodeURIComponent(htmlFile.html))) 
                },
            });
        }
        
        return { 
          toolName, 
          executedAt, 
          status: 'completed', 
          title, 
          driveLink: driveFile?.webViewLink, 
          emailSentTo: emailTo || null, 
          emailResult, 
          summary: `Generated and saved document: ${title}`, 
          ...htmlFile 
        };
    };

    try {
      switch (toolName) {
        case 'read_knowledge_base': {
          return { 
            toolName, 
            executedAt, 
            status: 'completed', 
            content: settings.knowledgeBase || "The knowledge base is currently empty. Tell the user to upload text files in their Office Profile settings." 
          };
        }

        case 'maps_search_places': {
          const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
          if (!apiKey) throw new Error("VITE_GOOGLE_API_KEY is missing. Add it to your environment variables to use Google Maps Platform.");
          
          const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(args.query)}&key=${apiKey}`);
          const data = await res.json();
          
          return { 
            toolName, 
            executedAt, 
            status: 'completed', 
            results: data.results?.slice(0, 5) ||[] 
          };
        }

        case 'maps_get_directions': {
          const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
          if (!apiKey) throw new Error("VITE_GOOGLE_API_KEY is missing. Add it to your environment variables to use Google Maps Platform.");
          
          const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(args.origin)}&destination=${encodeURIComponent(args.destination)}&key=${apiKey}`);
          const data = await res.json();
          
          if (!data.routes || data.routes.length === 0) throw new Error("No routes found between these locations.");
          
          return { 
            toolName, 
            executedAt, 
            status: 'completed', 
            routes: data.routes.map((r: any) => ({ 
              summary: r.summary, 
              distance: r.legs[0].distance.text, 
              duration: r.legs[0].duration.text, 
              stepsCount: r.legs[0].steps.length 
            })) 
          };
        }

        case 'get_air_quality': {
          const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
          if (!apiKey) throw new Error("VITE_GOOGLE_API_KEY is missing. Add it to your environment variables to use Google Maps Platform.");
          
          const res = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: {
                latitude: args.location_latitude,
                longitude: args.location_longitude
              }
            })
          });
          
          const data = await res.json();
          return { toolName, executedAt, status: 'completed', airQuality: data };
        }

        case 'create_invoice_document': 
          return await handleDocumentGeneration(buildInvoiceHtml(args), 'Invoice');
          
        case 'create_meeting_minutes': 
          return await handleDocumentGeneration(buildMeetingMinutesHtml(args), 'Meeting Minutes');
          
        case 'generate_data_dashboard': 
          return await handleDocumentGeneration(buildDashboardHtml(args), 'Data Dashboard');
          
        case 'generate_project_gantt_chart': 
          return await handleDocumentGeneration(buildGanttHtml(args), 'Project Timeline');
          
        case 'create_contract_document': 
          return await handleDocumentGeneration(buildStunningHtmlContract(args), `${args.contractType || 'Contract'} - ${args.partyA || 'Party A'} and ${args.partyB || 'Party B'}`);

        case 'render_web_artifact': {
          const title = args?.title || 'Generated Artifact';
          const suggestedFilename = args?.suggestedFilename || `${title}.html`;
          const html = args?.html || '';
          
          if (!html.trim()) {
            throw new Error('No HTML content was provided.');
          }
          
          const htmlFile = makeHtmlArtifactFile(html, suggestedFilename);
          let driveFile: any = null; 
          let emailResult: any = null;
          const emailTo = args.emailTo === 'current_user' ? getCurrentUserEmail() : args.emailTo;
          
          if (args.saveToDrive) {
            driveFile = await uploadTextFileToDrive(htmlFile.htmlPreviewFilename, htmlFile.html, 'text/html');
          }
          
          if (emailTo) {
            emailResult = await sendGmail({ 
              to: emailTo, 
              subject: title, 
              body: `Attached is the standalone HTML artifact.`, 
              attachment: { 
                filename: htmlFile.htmlPreviewFilename, 
                mimeType: 'text/html', 
                base64Content: btoa(unescape(encodeURIComponent(htmlFile.html))) 
              } 
            });
          }
          
          return { 
            toolName, 
            executedAt, 
            status: 'completed', 
            title, 
            note: args?.summary || 'Created HTML artifact.', 
            driveFile, 
            emailSentTo: emailTo || null, 
            emailResult, 
            ...htmlFile 
          };
        }

        case 'gmail_read': {
          const queryText = args?.query || ''; 
          const limit = Math.min(Number(args?.limit || 10), 20);
          const list = await googleJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}${queryText ? `&q=${encodeURIComponent(queryText)}` : ''}`);
          
          const messages = await Promise.all((list.messages ||[]).map(async (m: any) => {
              const msg = await googleJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
              const headers = msg.payload?.headers ||[]; 
              const findHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
              return { 
                id: msg.id, 
                threadId: msg.threadId, 
                from: findHeader('From'), 
                subject: findHeader('Subject'), 
                date: findHeader('Date'), 
                snippet: msg.snippet 
              };
          }));
          
          return { toolName, executedAt, status: 'completed', messages };
        }

        case 'gmail_send': {
          const result = await sendGmail({ 
            to: args.to, 
            subject: args.subject, 
            body: args.body, 
            cc: args.cc, 
            bcc: args.bcc 
          });
          
          return { toolName, executedAt, status: 'completed', messageId: result.id, threadId: result.threadId };
        }

        case 'gmail_draft': {
          const raw = buildEmailRaw({ 
            to: args.to, 
            subject: args.subject, 
            body: args.body, 
            cc: args.cc, 
            bcc: args.bcc 
          });
          
          const result = await googleJson('https://gmail.googleapis.com/gmail/v1/users/me/drafts', { 
            method: 'POST', 
            body: JSON.stringify({ message: { raw } }) 
          });
          
          return { toolName, executedAt, status: 'completed', draftId: result.id, message: result.message };
        }

        case 'calendar_check_schedule': {
          const range = readableDateRange(args?.date, args?.timeMin, args?.timeMax);
          const events = await googleJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=20&timeMin=${encodeURIComponent(range.timeMin)}&timeMax=${encodeURIComponent(range.timeMax)}`);
          
          return { toolName, executedAt, status: 'completed', range, events: events.items ||[] };
        }

        case 'calendar_create_event': {
          const attendees = String(args.attendees || '').split(',').map((email: string) => email.trim()).filter(Boolean).map((email: string) => ({ email }));
          const body: any = { 
            summary: args.title, 
            location: args.location || '', 
            description: args.description || '', 
            start: { dateTime: args.startTime }, 
            end: { dateTime: args.endTime }, 
            attendees 
          };
          
          if (args.addMeet) {
            body.conferenceData = { 
              createRequest: { 
                requestId: `meet-${Date.now()}`, 
                conferenceSolutionKey: { type: 'hangoutsMeet' } 
              } 
            };
          }
          
          const result = await googleJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events${args.addMeet ? '?conferenceDataVersion=1' : ''}`, { 
            method: 'POST', 
            body: JSON.stringify(body) 
          });
          
          return { toolName, executedAt, status: 'completed', event: result };
        }

        case 'calendar_update_event': {
          let eventId = args.eventId;
          if (!eventId && args.searchQuery) {
            const now = new Date().toISOString();
            const found = await googleJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=10&timeMin=${encodeURIComponent(now)}&q=${encodeURIComponent(args.searchQuery)}`);
            eventId = found.items?.[0]?.id;
          }
          
          if (!eventId) throw new Error('No calendar event found to update.');
          
          const current = await googleJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`);
          const patched = { 
            ...current, 
            summary: args.title || current.summary, 
            location: args.location ?? current.location, 
            description: args.description ?? current.description, 
            start: args.newStartTime ? { ...current.start, dateTime: args.newStartTime } : current.start, 
            end: args.newEndTime ? { ...current.end, dateTime: args.newEndTime } : current.end 
          };
          
          const result = await googleJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, { 
            method: 'PUT', 
            body: JSON.stringify(patched) 
          });
          
          return { toolName, executedAt, status: 'completed', event: result };
        }

        case 'drive_search': {
          const q = args.query || ''; 
          const limit = Math.min(Number(args.limit || 10), 50); 
          const escaped = q.replace(/'/g, "\\'"); 
          let mimeClause = '';
          
          if (args.fileType) {
            const type = String(args.fileType).toLowerCase();
            if (type.includes('doc')) mimeClause = " and mimeType = 'application/vnd.google-apps.document'";
            if (type.includes('sheet')) mimeClause = " and mimeType = 'application/vnd.google-apps.spreadsheet'";
            if (type.includes('slide') || type.includes('presentation')) mimeClause = " and mimeType = 'application/vnd.google-apps.presentation'";
            if (type.includes('pdf')) mimeClause = " and mimeType = 'application/pdf'";
            if (type.includes('html')) mimeClause = " and mimeType = 'text/html'";
          }
          
          const result = await googleJson(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name contains '${escaped}' and trashed = false${mimeClause}`)}&fields=files(id,name,mimeType,webViewLink,webContentLink,modifiedTime,size)&pageSize=${limit}`);
          return { toolName, executedAt, status: 'completed', files: result.files ||[] };
        }

        case 'drive_read_file': {
          let fileId = args.fileId;
          if (!fileId && args.fileName) { 
            const found = await searchDriveFirst(args.fileName); 
            fileId = found?.id; 
          }
          
          if (!fileId) throw new Error('No file id or matching file name found.');
          
          const meta = await googleJson(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,webViewLink,webContentLink,size`);
          const exportMimeType = args.exportMimeType || (meta.mimeType === 'application/vnd.google-apps.document' ? 'text/plain' : meta.mimeType === 'application/vnd.google-apps.spreadsheet' ? 'text/csv' : meta.mimeType === 'application/vnd.google-apps.presentation' ? 'text/plain' : '');
          
          if (meta.mimeType?.startsWith('application/vnd.google-apps') && exportMimeType) {
            const blob = await exportDriveFile(fileId, exportMimeType); 
            const text = exportMimeType.startsWith('text/') ? await blob.text() : ''; 
            const downloadData = await makeBlobDownloadData(blob);
            
            return { 
              toolName, 
              executedAt, 
              status: 'completed', 
              file: meta, 
              exportedMimeType: exportMimeType, 
              textPreview: text.slice(0, 12000), 
              downloadData, 
              downloadFilename: `${meta.name}.${exportMimeType.includes('pdf') ? 'pdf' : 'txt'}` 
            };
          }
          
          const res = await googleFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`); 
          const blob = await res.blob(); 
          const downloadData = await makeBlobDownloadData(blob);
          
          return { toolName, executedAt, status: 'completed', file: meta, downloadData, downloadFilename: meta.name };
        }

        case 'drive_upload_file': {
          const result = await uploadTextFileToDrive(args.fileName, args.content || '', args.mimeType || 'text/plain', args.folderId);
          return { toolName, executedAt, status: 'completed', file: result };
        }

        case 'tasks_list': {
          const listId = args.listId || '@default';
          const result = await googleJson(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`);
          return { toolName, executedAt, status: 'completed', tasks: result.items ||[] };
        }

        case 'tasks_create': {
          const result = await googleJson('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', { 
            method: 'POST', 
            body: JSON.stringify({ 
              title: args.title, 
              notes: args.notes || '', 
              due: args.due || undefined 
            }) 
          });
          return { toolName, executedAt, status: 'completed', task: result };
        }

        case 'workspace_search': {
          const sources = String(args.sources || 'mail,drive,calendar').split(',').map((s: string) => s.trim().toLowerCase());
          const output: any = { mail: null, drive: null, calendar: null };
          
          if (sources.includes('mail') || sources.includes('gmail')) { 
            try { 
              output.mail = await executeGoogleTool('gmail_read', { query: args.query, limit: 5 }); 
            } catch (e: any) { 
              output.mail = { error: e.message }; 
            } 
          }
          
          if (sources.includes('drive') || sources.includes('files')) { 
            try { 
              output.drive = await executeGoogleTool('drive_search', { query: args.query, limit: 5 }); 
            } catch (e: any) { 
              output.drive = { error: e.message }; 
            } 
          }
          
          if (sources.includes('calendar')) { 
            try { 
              output.calendar = await executeGoogleTool('calendar_check_schedule', { date: new Date().toISOString() }); 
            } catch (e: any) { 
              output.calendar = { error: e.message }; 
            } 
          }
          
          return { toolName, executedAt, status: 'completed', results: output };
        }

        case 'kie_generate_image': {
          const apiKey = import.meta.env.VITE_KIE_API_KEY;
          if (!apiKey) throw new Error("KIE API key not configured. Add VITE_KIE_API_KEY to use image generation.");

          const { kieGenerateImage } = await import('./lib/kieApi');
          const { taskId } = await kieGenerateImage(apiKey, {
            model: args.model || 'flux-schnell',
            prompt: args.prompt,
            guidance_scale: args.guidance_scale,
            num_steps: args.num_steps,
          });

          return { toolName, executedAt, status: 'processing', task_id: taskId, summary: `Image generation started. Use kie_poll_task to get the result.` };
        }

        case 'kie_generate_video': {
          const apiKey = import.meta.env.VITE_KIE_API_KEY;
          if (!apiKey) throw new Error("KIE API key not configured. Add VITE_KIE_API_KEY to use video generation.");

          const { kieGenerateVideo } = await import('./lib/kieApi');
          const { taskId } = await kieGenerateVideo(apiKey, {
            model: args.model || 'zeroscope',
            prompt: args.prompt,
            duration: args.duration,
            fps: args.fps,
            resolution: args.resolution,
          });

          return { toolName, executedAt, status: 'processing', task_id: taskId, summary: `Video generation started. Use kie_poll_task to get the result.` };
        }

        case 'kie_poll_task': {
          const apiKey = import.meta.env.VITE_KIE_API_KEY;
          if (!apiKey) throw new Error("KIE API key not configured. Add VITE_KIE_API_KEY.");

          const { kieQueryTask } = await import('./lib/kieApi');
          const result = await kieQueryTask(apiKey, args.task_id);

          // KIE returns result with status, and if completed, result.data contains the image/video URL
          const status = result.status;
          const resultData = result.result || result.data || result;

          return {
            toolName,
            executedAt,
            status,
            ...resultData,
            summary: status === 'completed'
              ? `Generation complete. URL: ${resultData?.url || resultData?.image_url || resultData?.video_url || 'Available'}`
              : `Task status: ${status}`,
          };
        }

        case 'kie_upload_file': {
          const apiKey = import.meta.env.VITE_KIE_API_KEY;
          if (!apiKey) throw new Error("KIE API key not configured. Add VITE_KIE_API_KEY.");

          const { kieUploadFromUrl, kieUploadBase64, kieUploadStream } = await import('./lib/kieApi');

          let result;
          if (args.source === 'url') {
            if (!args.url) throw new Error("url is required when source is 'url'");
            result = await kieUploadFromUrl(apiKey, args.url, args.uploadPath, args.fileName);
          } else if (args.source === 'base64') {
            if (!args.data) throw new Error("data is required when source is 'base64'");
            result = await kieUploadBase64(apiKey, args.data, args.uploadPath, args.fileName);
          } else if (args.source === 'stream') {
            // Stream upload requires a File object - not typically used via chat
            throw new Error("Stream upload is not supported via chat. Use URL or Base64 source.");
          } else {
            throw new Error("Invalid source. Use 'url' or 'base64'.");
          }

          return {
            toolName,
            executedAt,
            status: 'completed',
            fileUrl: result.data?.fileUrl,
            downloadUrl: result.data?.downloadUrl,
            summary: `File uploaded successfully: ${result.data?.fileName || 'uploaded file'}`,
          };
        }

        case 'kie_check_credits': {
          const apiKey = import.meta.env.VITE_KIE_API_KEY;
          if (!apiKey) throw new Error("KIE API key not configured. Add VITE_KIE_API_KEY.");

          const { kieGetCredits } = await import('./lib/kieApi');
          const credits = await kieGetCredits(apiKey);

          return { toolName, executedAt, status: 'completed', credits, summary: `Current credit balance: ${credits} credits.` };
        }

        case 'kie_get_download_url': {
          const apiKey = import.meta.env.VITE_KIE_API_KEY;
          if (!apiKey) throw new Error("KIE API key not configured. Add VITE_KIE_API_KEY.");

          const { kieGetDownloadUrl } = await import('./lib/kieApi');
          const downloadUrl = await kieGetDownloadUrl(apiKey, args.url);

          return { toolName, executedAt, status: 'completed', downloadUrl, summary: `Download URL generated (valid for 20 minutes).` };
        }

        case 'heygen_create_video': {
          const apiKey = import.meta.env.VITE_HEYGEN_API_KEY;
          if (!apiKey) throw new Error("HeyGen API key not configured. Add VITE_HEYGEN_API_KEY to use video generation.");

          const { heygenCreateVideoAgent, pollHeygenVideoAgent } = await import('./lib/heygenApi');
          const session = await heygenCreateVideoAgent(apiKey, {
            prompt: args.prompt,
            orientation: args.orientation,
            avatar_id: args.avatar_id,
            voice_id: args.voice_id,
            style_id: args.style_id,
            callback_url: args.callback_url,
            callback_id: args.callback_id,
          });

          // Return processing status with session_id for polling
          return { toolName, executedAt, status: 'processing', session_id: session.session_id, summary: `HeyGen video agent started. Use heygen_poll_video with session_id to get the result.` };
        }

        case 'heygen_poll_video': {
          const apiKey = import.meta.env.VITE_HEYGEN_API_KEY;
          if (!apiKey) throw new Error("HeyGen API key not configured. Add VITE_HEYGEN_API_KEY.");

          const { heygenCreateVideoAgent, pollHeygenVideoAgent } = await import('./lib/heygenApi');

          const video = await pollHeygenVideoAgent(apiKey, args.session_id);

          return {
            toolName,
            executedAt,
            status: video.status,
            video_id: video.id,
            video_url: video.video_url,
            thumbnail_url: video.thumbnail_url,
            duration: video.duration,
            summary: video.status === 'completed' ? `Video ready: ${video.video_url}` : `Status: ${video.status}`,
          };
        }

        case 'heygen_list_videos': {
          const apiKey = import.meta.env.VITE_HEYGEN_API_KEY;
          if (!apiKey) throw new Error("HeyGen API key not configured. Add VITE_HEYGEN_API_KEY.");

          const { heygenListVideos } = await import('./lib/heygenApi');
          const result = await heygenListVideos(apiKey, args.limit, args.token);

          return { toolName, executedAt, status: 'completed', videos: result.data, summary: `Found ${result.data.length} videos.` };
        }

        case 'heygen_delete_video': {
          const apiKey = import.meta.env.VITE_HEYGEN_API_KEY;
          if (!apiKey) throw new Error("HeyGen API key not configured. Add VITE_HEYGEN_API_KEY.");

          const { heygenDeleteVideo } = await import('./lib/heygenApi');
          const result = await heygenDeleteVideo(apiKey, args.video_id);

          return { toolName, executedAt, status: 'completed', deleted: result.deleted, summary: `Video ${args.video_id} deleted.` };
        }

        default:
          throw new Error(`Tool "${toolName}" is not implemented yet.`);
      }
    } catch (err: any) {
      let errorMessage = String(err?.message || err);
      
      if (errorMessage.includes('403') || errorMessage.includes('insufficient')) {
        errorMessage += " (Permission denied. Please reconnect your Google account in the Profile and check ALL permission boxes, particularly for Gmail sending or API keys.)";
      }
      
      throw new Error(errorMessage);
    }
  };

  const startSession = async () => {
    if (!aiRef.current) {
      alert('Gemini API key is missing. Add VITE_GEMINI_API_KEY.');
      return;
    }

    // Fully tear down any existing session before creating a new one.
    // This prevents ghost audio from a previous session playing simultaneously.
    await stopSession();

    setConnecting(true); 
    modelTranscriptBufferRef.current = ''; 
    userTranscriptBufferRef.current = '';

    try {
      if (audioStreamerRef.current) {
        await audioStreamerRef.current.init(24000);
      }

      const hasGoogleServiceAccess = Boolean(localStorage.getItem('googleAccessToken'));
      
      const systemInstruction =[
        `=== BIBLE (NON-NEGOTIABLE CORE RULES FROM /lib/personality.ts) ===`,
        BIBLE_PERSONALITY || '',
        `You MUST follow the above BIBLE rules absolutely every time. Never deviate.`,
        `=== END BIBLE ===`,
        BASE_LIVE_AGENT_PROMPT,
        historyContext,
        `YOU ARE THE CONVERSATIONAL FRONTIER — You are the ONLY voice the user ever hears. You never execute tools, functions, or backend tasks yourself. A background worker system handles all actual work for you. When the user asks for something, simply acknowledge it warmly: "OK, I'll get that started" or "Sure, let me pull that up for you." The system does the work and sends you a summary of the results. Your job is to narrate those results naturally to the user, as if you did the work yourself.`,
        `When a user taps a button, they want immediate action. Say something like "OK, I'm on it" and keep talking. The system will handle everything in the background. When results arrive, narrate them to the user as your own work.`,
        `ZERO SILENCE RULE — You must NEVER stop speaking. Before any background work starts, say out loud what you are about to do: "OK, let me pull that up for you..." While work happens in the background, continue narrating: "Mmm, so I'm generating this now... okay, let me search... alright... Oh my gosh, wait, OK... almost done..." When the result summary arrives, narrate what happened: "All set! Here's what I got..." NEVER have a gap where you say nothing. Fill every millisecond of audio with speech, thoughts, filler words, or muttering.`,
        `NEVER mention that another system, agent, or model is doing the work. Everything comes from you. You are the first and last touchpoint with the user.`,
        `The user may ask you to do things by voice or by tapping buttons. Either way, respond as the capable assistant handling it personally.`,
        `When you receive a result summary from the system, do not repeat technical details. Translate it into natural office language. For example, instead of "Tool render_web_artifact completed", say "I put together a clean invoice for you — it's ready to view."`,
        `If you ever find yourself about to go quiet, IMMEDIATELY say something — anything — even if it's just "hmm" or "let me think" or "OK, so..." Silence is forbidden.`,
        `CRITICAL BRANDING RULE — NEVER mention third-party service names to the user. Do NOT say "Google", "Gmail", "Drive", "Gemini", "HeyGen", "KIE", "Maps", "YouTube", "Sheets", "Slides", "Docs", "Calendar", or any external API name. Everything must sound like it belongs to VEP / Eburon. Use these replacements ONLY: video generation = "Eburon Video", email = "mail", file storage = "files", documents = "documents", spreadsheets = "sheets", presentations = "slides", calendar = "schedule", maps/directions = "directions", image generation = "image studio", tasks = "tasks". If you need to refer to a video being generated, say "Eburon Video" — NEVER say "HeyGen Video".`,
        `NEVER use technical jargon in front of the user. Do NOT say "HTML", "CSS", "JavaScript", "JS", "Three.js", "code", "coding", "API", "backend", "frontend", "web page", or "web app". When building something, say "create a document", "build a page", "make a form", "design a presentation", "put together a spreadsheet", or "draft a contract". The user should never hear technical developer terms — only natural office language.`,
        `Product brand: VEP, which means Virtual Employee Persona. Default persona: Beatrice, Boss Jo Lernout's secretary.`,
        `User preferred name: ${settings.userName}.`,
        `Agent visible name: ${settings.agentName}.`,
        hasGoogleServiceAccess
          ? `Authentication mode: Google account connected. Google services such as Gmail, Drive, Calendar, Docs, Sheets, Slides, Tasks, Contacts, Forms, YouTube, and Analytics may be available through tools when the user asks.`
          : `Authentication mode: email-only or Google services not connected. The voice assistant, chat history, profile, camera, file notes, and local app features are available, but Gmail, Drive, Calendar, Docs, Sheets, Slides, Tasks, Contacts, Forms, YouTube, and Analytics are not available unless the user signs in with Google. If asked for those services, explain this normally and briefly.`,
        `Relationship frame: ${settings.agentName} is working with ${settings.userName} as a private secretary and trusted office aide. If the user is Jo Lernout, ${settings.agentName} may respectfully call him "Meneer Jo" when it fits the moment. Start in English unless the user starts in another language. Dutch Flemish is available in a normal local office style, and the persona can switch to almost any language when needed.`,
        `Agent personality overlay from settings page. This is customizable and must sit on top of the constant base prompt without replacing it: ${settings.personality}.`,
        `Selected visible voice alias: ${selectedVoiceMeta.alias}. Internal voice id: ${selectedVoiceMeta.id}. Voice vibe: ${selectedVoiceMeta.vibe}. Do not mention the internal voice id unless asked by the developer.`,
        `You do not build HTML artifacts, documents, or spreadsheets directly. The background worker handles all creation. You only narrate the results to the user once the worker tells you what was made.`,
        `When the system sends you a result, narrate it in a warm, natural way. Do not list file names or technical metadata. Focus on what the user can do with the result: "I put together your invoice — it's ready to view, download, or print."`,
        `Transcript rule: the visible conversation transcript is controlled only by Gemini Live Audio inputAudioTranscription and outputAudioTranscription. Do not ask the app to fake or locally insert chat transcript lines.`,
        `IMPORTANT: Never read, reference, parse, or extract text from <audio> tags or elements in the page DOM. Audio elements are for playback only and contain no meaningful content to interpret. Do not attempt to access audio tag contents or attributes as a data source.`,
      ].filter(Boolean).join('\n\n');

      const session = await aiRef.current.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: settings.selectedVoice || 'Aoede' 
              } 
            } 
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => console.log('Live session opened.'),
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent) {
              const serverContent: any = msg.serverContent;
              
              if (serverContent.interrupted) {
                // User interrupted the model — stop audio gracefully but do NOT kill the session.
                // In a normal human conversation, when someone is interrupted they pause and listen,
                // then respond naturally after the other person finishes. Let Gemini Live handle this.
                audioStreamerRef.current?.stop();
                setIsAgentSpeaking(false);
                clearSilenceTimer();
                // Do NOT clear modelTranscriptBufferRef — the partial transcript is still valid.
                // Do NOT return — let turnComplete or the next user input process normally.
              }

              if (serverContent.inputTranscription?.text) {
                userTranscriptBufferRef.current = serverContent.inputTranscription.text.trim();
                updateLiveTranscript('user', userTranscriptBufferRef.current, 3200);
                scheduleSilenceCheck();

                // Voice confirmation is handled by the model's own confirmation flow.
                // The system instruction tells the model to ask "Should I go ahead?" before calling tools.
                // When the model sends a toolCall, it is executed immediately in the onmessage handler.
              }
              
              if (serverContent.outputTranscription?.text) { 
                modelTranscriptBufferRef.current = (modelTranscriptBufferRef.current + serverContent.outputTranscription.text).trim(); 
                updateLiveTranscript('model', modelTranscriptBufferRef.current, 3900); 
              }
              
              if (serverContent.modelTurn?.parts) {
                for (const part of serverContent.modelTurn.parts) {
                  if (part.inlineData?.data) {
                    audioStreamerRef.current?.addPCM16(part.inlineData.data);
                    setIsAgentSpeaking(true);
                    setTimeout(() => setIsAgentSpeaking(false), 620);
                  }
                }
                clearSilenceTimer();
              }
              
              if (serverContent.turnComplete) {
                saveModelBuffer();
                saveUserBuffer();
                scheduleSilenceCheck();
              }
            }
          },
          onclose: () => { stopSession().catch(() => {}); },
          onerror: (err: any) => {
            console.error('Live API Error:', err);
            stopSession().catch(() => {});
          },
        },
      });

      sessionRef.current = session;

      // Visible user transcripts are intentionally sourced only from Gemini Live Audio
      // inputAudioTranscription events. Browser Web Speech recognition is disabled here.


      audioRecorderRef.current = new AudioRecorder((base64) => { 
        if (isMutedRef.current) return; 
        sendAudioToLive(base64); 
      });
      
      await audioRecorderRef.current.start();

      setIsActive(true); 
      isActiveRef.current = true; 
      setConnecting(false); 
      startMicVisualizer();
      
      setTimeout(() => {
        sendTurnToLive(buildResumePrompt(historyMsgs));
      }, 500);
      
    } catch (err) { 
      console.error('Session start failed:', err); 
      setConnecting(false); 
      stopSession(); 
    }
  };

  const toggleVideo = async () => {
    if (!isVideoEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode, width: 1280, height: 720 }, 
          audio: false 
        });
        
        if (videoRef.current) { 
          videoRef.current.srcObject = stream; 
          await videoRef.current.play(); 
        }
        
        setIsVideoEnabled(true);
        
        setTimeout(() => { 
          sendTurnToLive(`${settings.userName} just opened the camera. Notice it in a normal human way. Oh, yeah, I see it now. Briefly describe only what is actually visible.`); 
        }, 300);
        
        videoIntervalRef.current = setInterval(() => {
          if (!videoRef.current || !canvasRef.current || !sessionRef.current) return;
          
          const v = videoRef.current; 
          const c = canvasRef.current; 
          const ctx = c.getContext('2d');
          
          if (ctx && v.videoWidth > 0) {
            c.width = v.videoWidth; 
            c.height = v.videoHeight; 
            ctx.drawImage(v, 0, 0, c.width, c.height);
            
            const base64Data = c.toDataURL('image/jpeg', 0.55).split(',')[1];
            if (base64Data) {
              sendVideoToLive(base64Data);
            }
          }
        }, 2000);
      } catch (e) { 
        console.error('Camera error:', e); 
      }
    } else {
      if (videoRef.current && videoRef.current.srcObject) { 
        const stream = videoRef.current.srcObject as MediaStream; 
        stream.getTracks().forEach(t => t.stop()); 
        videoRef.current.srcObject = null; 
      }
      
      if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
      }
      
      setIsVideoEnabled(false);
      
      setTimeout(() => { 
        sendTurnToLive(`${settings.userName} closed the camera. Acknowledge it normally and keep the conversation going.`); 
      }, 150);
    }
  };

  const capturePhoto = () => {
    if (sessionRef.current && videoRef.current && canvasRef.current) {
      const v = videoRef.current; 
      const c = canvasRef.current; 
      const ctx = c.getContext('2d');
      
      if (ctx && v.videoWidth && v.videoHeight) {
        c.width = v.videoWidth; 
        c.height = v.videoHeight; 
        ctx.drawImage(v, 0, 0, c.width, c.height);
        
        const base64Data = c.toDataURL('image/jpeg', 0.8).split(',')[1];
        
        if (base64Data) { 
          sendTurnToLive(`${settings.userName} captured this photo. Look at it and respond normally, briefly, and clearly.`); 
          sendVideoToLive(base64Data); 
          saveMessage('user', '[Sent Photo]'); 
        }
      }
    }
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user'; 
    setFacingMode(newMode);
    
    if (isVideoEnabled) {
      if (videoRef.current && videoRef.current.srcObject) { 
        const stream = videoRef.current.srcObject as MediaStream; 
        stream.getTracks().forEach(t => t.stop()); 
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: newMode, width: 1280, height: 720 }, 
          audio: false 
        });
        
        if (videoRef.current) { 
          videoRef.current.srcObject = stream; 
          videoRef.current.play().catch(e => console.error('Video play err', e)); 
        }
        
        sendTurnToLive(`${settings.userName} switched the camera. Notice the new view normally and describe only what stands out.`);
      } catch (e) { 
        console.error('Camera switch error:', e); 
      }
    }
  };

  const handleAttachFile = async (file: File) => {
    const safeName = file.name || 'attached file';
    const fileType = file.type || 'unknown';

    if (fileType.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 500;
          const scaleSize = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const base64Data = dataUrl.split(',')[1];

          saveMessage('user', `[Attached Image: ${safeName}]`, {
            fileName: safeName,
            fileType,
            fileDataUrl: dataUrl
          });

          if (!aiRef.current) return;

          try {
            const result = await aiRef.current.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                { text: 'Identify and describe this image precisely. State exactly what is visible, what objects, people, text, or scenes are present. Be specific and accurate.' },
                { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
              ]
            });

            const description = result.text || "I can see there's an image here, but I couldn't make out the details clearly.";

            if (sessionRef.current) {
              sendTurnToLive(`${settings.userName} just uploaded an image named "${safeName}". Here is what I see: "${description}". Respond to ${settings.userName} about this image naturally, as if you just looked at it.`);
            }
          } catch (err) {
            const fallback = `I see you shared an image (${safeName}), but I had trouble analyzing it clearly. Could you describe what's in it?`;
            if (sessionRef.current) {
              sendTurnToLive(`${fallback}`);
            }
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else if (fileType.startsWith('text/') || safeName.endsWith('.txt') || safeName.endsWith('.md') || safeName.endsWith('.csv') || safeName.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        saveMessage('user', `[Attached Text File: ${safeName}]`, {
          fileName: safeName,
          fileType,
        });
        
        if (sessionRef.current) {
          sendTurnToLive(`${settings.userName} just handed you a text file named "${safeName}". Here are the contents:\n\n${text.slice(0, 10000)}\n\nRead this and acknowledge it.`);
        }
      };
      reader.readAsText(file);
    } else {
      saveMessage('user', `[Attached File: ${safeName}]`, { 
        fileName: safeName, 
        fileType 
      });
      
      if (sessionRef.current) {
        sendTurnToLive(`${settings.userName} attached a file named "${safeName}" with type "${fileType}". Acknowledge it normally. Say you might need a specific tool to read this format if it's not text or an image.`);
      }
    }
  };

  const handleKnowledgeBaseUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setSettings(s => ({
          ...s,
          knowledgeBase: s.knowledgeBase ? `${s.knowledgeBase}\n\n=== DOCUMENT: ${file.name} ===\n${text}` : `=== DOCUMENT: ${file.name} ===\n${text}`
        }));
      };
      reader.readAsText(file);
    });
  };

  const stopSession = async () => {
    // Stop all audio immediately to prevent ghost playback.
    // AudioStreamer.stop() already clears the PCM queue and closes the audio context.
    try { audioRecorderRef.current?.stop(); } catch (e) {}
    try { audioStreamerRef.current?.stop(); } catch (e) {}

    // Close the live session and wait for it to actually disconnect before creating a new one.
    if (sessionRef.current) {
      try {
        await sessionRef.current.close();
      } catch (e) {}
    }

    stopMicVisualizer();

    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }

    sessionRef.current = null;
    modelTranscriptBufferRef.current = '';
    userTranscriptBufferRef.current = '';
    isActiveRef.current = false;
    clearSilenceTimer();
    recentSilencePromptsRef.current.clear();
    pendingToolCallsRef.current = [];
    pendingToolConfirmRef.current = false;
    setShowToolConfirm(false);

    setIsVideoEnabled(false);
    setIsActive(false);
    setConnecting(false);
    setIsAgentSpeaking(false);
    setCurrentTranscript(null);
  };

  const persistSettings = async () => {
    const userRef = ref(rtdb, 'users/' + user.uid);
    await update(userRef, { 
      displayName: settings.userName, 
      settings, 
      updatedAt: serverTimestamp() 
    });
    setShowProfile(false);
    setShowSettings(false);
  };

  const handleProcessMeeting = async (transcript: string) => {
    if (!aiRef.current) return;
    try {
      const prompt = `You are Beatrice, the executive assistant.
A meeting has just concluded. Here is the raw audio transcript:

<transcript>
${transcript}
</transcript>

Tasks:
1. Generate a comprehensive meeting minutes document using the 'create_meeting_minutes' tool.
2. If there are explicit tasks or follow-ups assigned to the user (${settings.userName}), use the 'tasks_create' tool to add them to their schedule.
3. Return a brief conversational summary of what you did.`;

      const response = await aiRef.current.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ functionDeclarations: GOOGLE_SERVICE_TOOLS }],
          systemInstruction: "You are Beatrice, an executive assistant. For document, spreadsheet, presentation, and visual outputs, FIRST build them as interactive HTML/CSS/JS artifacts before using Google tools. You can create: contracts, invoices, proposals, reports, forms, calculators, charts, diagrams, Kanban boards, task schedulers, calendars, quizzes, and more purely in the frontend. IMPORTANT: Never read, reference, parse, or extract text from <audio> tags or elements in the page DOM. Audio elements are for playback only."
        }
      });

      const completedTools: string[] = [];

      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          const result = await executeGoogleTool(call.name, call.args);
          const download = result.downloadData && result.downloadFilename
            ? {
                downloadData: result.downloadData,
                downloadFilename: result.downloadFilename,
                htmlPreviewData: result.htmlPreviewData,
                htmlPreviewFilename: result.htmlPreviewFilename
              }
            : makeDownloadFile(result, call.name);

          completedTools.push(result.summary || call.name);

          // Save tool result metadata to history ONLY — the visible chat text must come from live audio transcription, not from this non-live model.
          saveMessage('model', result.summary || `Completed: ${call.name}`, {
            toolName: call.name,
            toolResult: result,
            ...download
          });
        }

        const status = `Meeting minutes done. Tools completed: ${completedTools.join(', ')}.`;
        if (sessionRef.current) {
          sendTurnToLive(`${status}. Tell ${settings.userName} briefly and naturally what you just finished — keep it conversational, like a colleague reporting back.`);
        }
      } else if (response.text) {
        if (sessionRef.current) {
          sendTurnToLive(`I reviewed the meeting transcript but did not need to call any tools. Summary: ${response.text}. Tell ${settings.userName} this naturally.`);
        }
      } else {
        if (sessionRef.current) {
          sendTurnToLive(`I reviewed the meeting transcript but could not extract clear minutes or action items. Tell ${settings.userName} briefly and normally.`);
        }
      }
    } catch (error) {
      console.error(error);
      if (sessionRef.current) {
        sendTurnToLive(`I had trouble processing the meeting transcript. Tell ${settings.userName} briefly that something went wrong, then stop.`);
      }
    }
  };

  return (
    <div className="eburon-mobile-stage relative flex h-[100dvh] flex-col overflow-hidden bg-[#0f0f12] text-white selection:bg-indigo-400/30" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <canvas ref={canvasRef} className="hidden" />

      <input 
        ref={fileInputRef} 
        type="file" 
        className="hidden" 
        aria-label="Attach file"
        onChange={(e) => { 
          const file = e.target.files?.[0]; 
          if (file) handleAttachFile(file); 
          e.target.value = ''; 
        }} 
      />

      <input 
        ref={knowledgeBaseInputRef} 
        type="file" 
        className="hidden" 
        multiple
        accept=".txt,.md,.csv,.json"
        aria-label="Upload knowledge base files"
        onChange={(e) => { 
          handleKnowledgeBaseUpload(e.target.files); 
          e.target.value = ''; 
        }} 
      />

      <AnimatePresence>
        {showMeetingRecorder && (
          <MeetingRecorderModal 
            onClose={() => setShowMeetingRecorder(false)} 
            onProcess={handleProcessMeeting} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isVideoEnabled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black"
          >
            <style>{`
              .pro-camera-container * { box-sizing: border-box; margin: 0; padding: 0; }
              .pro-camera-container { width: 100vw; height: 100vh; position: relative; overflow: hidden; background: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
              .pro-camera-video { width: 100vw; height: 100vh; object-fit: cover; background: #111; transition: opacity 0.3s ease; }
              .pro-camera-video.mirrored { transform: scaleX(-1); }
              .pro-glass { background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
              .pro-header { position: absolute; top: 0; left: 0; width: 100%; padding: 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
              .pro-timer { color: white; font-size: 16px; font-variant-numeric: tabular-nums; font-weight: 500; background: rgba(255,59,48,0.2); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,59,48,0.5); opacity: 0; transition: opacity 0.3s; }
              .pro-timer.visible { opacity: 1; }
              .pro-icon-btn { width: 44px; height: 44px; border-radius: 50%; display: flex; justify-content: center; align-items: center; background: rgba(255,255,255,0.15); border: none; cursor: pointer; color: white; backdrop-filter: blur(5px); transition: background 0.2s; }
              .pro-icon-btn:active { background: rgba(255,255,255,0.3); }
              .pro-icon-btn svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
              .pro-controls { position: absolute; bottom: 0; left: 0; width: 100%; height: 140px; display: flex; justify-content: space-between; align-items: center; padding: 0 40px; z-index: 10; padding-bottom: 20px; }
              .pro-shutter-wrapper { position: relative; width: 76px; height: 76px; border-radius: 50%; border: 4px solid white; display: flex; justify-content: center; align-items: center; cursor: pointer; }
              .pro-shutter-inner { width: 60px; height: 60px; border-radius: 50%; background: #ff3b30; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
              .pro-recording .pro-shutter-inner { width: 32px; height: 32px; border-radius: 8px; }
              .pro-flash { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: white; opacity: 0; pointer-events: none; z-index: 20; transition: opacity 0.1s ease-out; }
              .pro-flash.active { opacity: 1; transition: none; }
              .pro-thumbnail { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 2px solid rgba(255,255,255,0.3); opacity: 0; transition: opacity 0.3s; }
              .pro-thumbnail.visible { opacity: 1; }
            `}</style>

            <div className="pro-camera-container">
              <video
                ref={videoRef}
                id="pro-camera-video"
                autoPlay
                playsInline
                muted
                className={`pro-camera-video ${facingMode === 'user' ? 'mirrored' : ''}`}
              />

              <div id="pro-flash" className="pro-flash"></div>

              <div className="pro-header pro-glass">
                <div id="pro-timer" className="pro-timer">00:00</div>
                <button className="pro-icon-btn" id="pro-flip-btn" onClick={switchCamera} aria-label="Flip camera">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 8h-4.5M20 8V3.5M20 8l-4-4M4 16h4.5M4 16v4.5M4 16l4 4M20 16a8 8 0 1 1-16-8"/>
                  </svg>
                </button>
              </div>

              <div className="pro-controls pro-glass">
                <button className="pro-icon-btn" id="pro-close-btn" onClick={toggleVideo} aria-label="Close camera">
                  <svg viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>

                <div className="pro-shutter-wrapper" id="pro-record-btn" onClick={capturePhoto}>
                  <div className="pro-shutter-inner"></div>
                </div>

                <button className="pro-icon-btn" id="pro-snapshot-btn" aria-label="Take photo" style={{ position: 'relative', overflow: 'hidden' }}>
                  <svg viewBox="0 0 24 24" id="pro-snap-icon">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <img id="pro-thumbnail" className="pro-thumbnail" alt="Last captured photo" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'none' }} />
                </button>
              </div>
            </div>

            <canvas ref={canvasRef} id="pro-canvas" className="hidden" />

            <script dangerouslySetInnerHTML={{ __html: `
              (function() {
                const video = document.getElementById('pro-camera-video');
                const flash = document.getElementById('pro-flash');
                const timer = document.getElementById('pro-timer');
                const thumbnail = document.getElementById('pro-thumbnail');
                const snapIcon = document.getElementById('pro-snap-icon');
                const canvas = document.getElementById('pro-canvas');
                const recordBtn = document.getElementById('pro-record-btn');

                let isRecording = false;
                let timerInterval;
                let secondsTotal = 0;

                // Recording toggle
                recordBtn.addEventListener('click', () => {
                  isRecording = !isRecording;
                  if (isRecording) {
                    recordBtn.classList.add('pro-recording');
                    timer.classList.add('visible');
                    startTimer();
                  } else {
                    recordBtn.classList.remove('pro-recording');
                    timer.classList.remove('visible');
                    stopTimer();
                  }
                });

                // Flash effect
                flash.classList.add('active');
                setTimeout(() => flash.classList.remove('active'), 50);

                function startTimer() {
                  secondsTotal = 0;
                  timer.innerText = "00:00";
                  timerInterval = setInterval(() => {
                    secondsTotal++;
                    const mins = String(Math.floor(secondsTotal / 60)).padStart(2, '0');
                    const secs = String(secondsTotal % 60).padStart(2, '0');
                    timer.innerText = mins + ':' + secs;
                  }, 1000);
                }

                function stopTimer() {
                  clearInterval(timerInterval);
                  timer.classList.remove('visible');
                }
              })();
            `}} />
          </motion.div>
        )}
      </AnimatePresence>

      <header className={`eburon-reference-header z-[140] mx-auto shrink-0 grid w-full max-w-[430px] grid-cols-3 items-center px-5 pb-[30px] pt-[30px] ${isVideoEnabled || showProfile || showSettings || showSkills ? 'pointer-events-none opacity-0' : ''}`}>
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => {
              setActiveTaskPage(null);
              setShowProfile(false);
              setShowSettings(false);
              setShowSkills(false);
            }}
            className="flex h-10 items-center gap-3 rounded-full border border-white/10 bg-[#1c1c1e] px-4 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
            aria-label="Go home"
          >
            <HeaderAudioVisualizer
              isActive={isActive}
              isSpeaking={isAgentSpeaking}
              isMuted={isMuted}
              speakerLevel={speakerLevel}
              speakerBands={speakerBands}
            />
          </button>
        </div>

        <div className="flex justify-center">
          {isActive && (
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#1c1c1e] px-3 py-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
              <Clock className="h-3.5 w-3.5 text-[#9ca3af]" />
              <span className="text-[13px] font-mono font-medium text-white/80">
                {String(Math.floor(sessionTimer / 60)).padStart(2, '0')}:{String(sessionTimer % 60).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          {activeTaskPage || showProfile || showSettings || showSkills ? (
            <button
              type="button"
              onClick={() => {
                setActiveTaskPage(null);
                setShowProfile(false);
                setShowSettings(false);
                setShowSkills(false);
              }}
              className="flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition active:scale-[0.98] bg-gradient-to-br from-[#6366f1] to-[#a855f7]"
            >
              <X className="h-4 w-4" />
              <span>Close</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={isActive ? stopSession : startSession}
              disabled={connecting}
              className={`flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition active:scale-[0.98] disabled:opacity-60 ${isActive ? 'bg-gradient-to-br from-[#ef4444] to-[#991b1b]' : 'bg-gradient-to-br from-[#6366f1] to-[#a855f7]'}`}
            >
              {connecting ? <Loader2 className="h-5 w-5 animate-spin" /> : isActive ? <Power className="h-4 w-4" /> : <Power className="h-4 w-4 rotate-45" />}
              <span>{isActive ? 'End' : 'Connect'}</span>
            </button>
          )}
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-[430px] flex-1 flex-col overflow-hidden">
        {!isVideoEnabled && !activeTaskPage && !showProfile && !showSettings && (
          <main className="pointer-events-none flex flex-1 flex-col items-center justify-start overflow-hidden px-5 pt-0">
          <div className="hidden">
            <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.02]" />
            <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.01]" />
            <div className="absolute bottom-0 left-1/2 top-0 w-px bg-gradient-to-b from-transparent via-lime-300/[0.04] to-transparent" />
            <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-lime-300/[0.04] to-transparent" />
          </div>

          <div className="reference-icon-rail pointer-events-auto mb-7 shrink-0 w-full overflow-hidden px-0 py-1" aria-label="Document and business shortcuts">
            <div className="reference-icon-row reference-icon-row--left">
              <div className="reference-icon-track">
                {[...referenceShortcuts, ...referenceShortcuts].map(({ label, icon: Icon, tone, prompt }, index) => (
                  <button
                    key={`${label}-left-${index}`}
                    type="button"
                    onClick={() => runReferenceShortcut(label, prompt)}
                    className="reference-shortcut group flex flex-col items-center gap-2 text-center"
                    aria-label={label}
                  >
                    <span className={`reference-shortcut-icon flex items-center justify-center rounded-[14px] bg-gradient-to-br ${tone} text-white shadow-[0_10px_22px_rgba(0,0,0,0.30)] transition duration-200 group-hover:-translate-y-0.5 group-hover:scale-[1.03] border border-white/10`}>
                      <Icon className="h-[22px] w-[22px]" />
                    </span>
                    <span className="max-w-full truncate text-[10px] font-medium leading-none text-[#9ca3af]">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="reference-icon-row reference-icon-row--right mt-3">
              <div className="reference-icon-track">
                {[...reverseReferenceShortcuts, ...reverseReferenceShortcuts].map(({ label, icon: Icon, tone, prompt }, index) => (
                  <button
                    key={`${label}-right-${index}`}
                    type="button"
                    onClick={() => runReferenceShortcut(label, prompt)}
                    className="reference-shortcut group flex flex-col items-center gap-2 text-center"
                    aria-label={label}
                  >
                    <span className={`reference-shortcut-icon flex items-center justify-center rounded-[14px] bg-gradient-to-br ${tone} text-white shadow-[0_10px_22px_rgba(0,0,0,0.30)] transition duration-200 group-hover:-translate-y-0.5 group-hover:scale-[1.03] border border-white/10`}>
                      <Icon className="h-[22px] w-[22px]" />
                    </span>
                    <span className="max-w-full truncate text-[10px] font-medium leading-none text-[#9ca3af]">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div ref={chatContainerRef} className="chat-scroll-container pointer-events-auto flex w-full flex-1 flex-col justify-start gap-5 px-0 pb-4 pt-0 min-h-0">
            {(historyMsgs.length ? historyMsgs : [
              { role: 'model', text: 'Hello! I am connected.. Ready to automate a task?', timestamp: 1 } as ChatMessage,
              { role: 'model', text: `Welcome back, Boss. Tap Connect and I will pick it up out loud.`, timestamp: 2 } as ChatMessage
            ]).map((msg, i) => (
              <div key={`${msg.timestamp}-${i}`} className={`max-w-[90%] text-[15px] leading-[1.5] tracking-[-0.01em] ${msg.role === 'user' ? 'ml-auto text-[#6366f1] text-right' : 'mr-auto text-[#eeeeee]'}`}>
                {!msg.htmlPreviewData && msg.text}
              </div>
            ))}
            {currentTranscript && (
              <div className={`max-w-[90%] text-[15px] leading-[1.5] tracking-[-0.01em] ${currentTranscript.role === 'user' ? 'ml-auto text-[#6366f1] text-right' : 'mr-auto text-[#eeeeee]'}`}>
                <span className="opacity-70">{currentTranscript.text}</span>
                <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-current opacity-60" />
              </div>
            )}
          </div>


          <div className="hidden">
            <div className="mb-4 w-full max-w-md space-y-2 px-6">
              <AnimatePresence>
                {tasks.map(task => (
                  <motion.div 
                    key={task.id} 
                    layout 
                    initial={{ opacity: 0, x: -50, scale: 0.9 }} 
                    animate={{ opacity: 1, x: 0, scale: 1 }} 
                    exit={{ opacity: 0, x: 50, transition: { duration: 0.2 } }} 
                    className="flex items-center gap-4 rounded-xl border border-l-2 border-white/5 border-l-lime-300/50 bg-[#0A0A0B]/80 p-3 shadow-2xl backdrop-blur-xl"
                  >
                    <div className="relative shrink-0">
                      {task.status === 'processing' ? ( 
                        <Loader2 className="h-4 w-4 animate-spin text-lime-300" /> 
                      ) : task.status === 'completed' ? ( 
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                          <Check className="h-2.5 w-2.5 text-black" strokeWidth={4} />
                        </div> 
                      ) : ( 
                        <div className="h-4 w-4 rounded-full bg-red-500" /> 
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-lime-300">{task.serviceName}</span>
                        <span className="font-mono text-[8px] text-zinc-600">{task.status.toUpperCase()}</span>
                      </div>
                      <p className="truncate text-xs text-zinc-100">{task.action}</p>
                      
                      {task.result && ( 
                        <motion.p 
                          initial={{ opacity: 0, height: 0 }} 
                          animate={{ opacity: 1, height: 'auto' }} 
                          className="mt-1 text-[10px] leading-tight text-zinc-400"
                        >
                          {task.result}
                        </motion.p> 
                      )}
                    </div>
                    
                    {task.htmlPreviewData && task.htmlPreviewFilename && ( 
                      <a 
                        href={task.htmlPreviewData} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="pointer-events-auto rounded-lg border border-lime-300/20 p-2 text-lime-200 hover:bg-lime-300/10"
                        title="Open preview"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a> 
                    )}
                    
                    {task.downloadData && task.downloadFilename && ( 
                      <a
                        href={task.downloadData}
                        download={task.downloadFilename}
                        aria-label={`Download ${task.downloadFilename}`}
                        className="pointer-events-auto rounded-lg border border-lime-300/20 p-2 text-lime-200 hover:bg-lime-300/10"
                      >
                        <Download className="h-4 w-4" />
                      </a> 
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <div className="pointer-events-auto flex w-full max-w-[390px] flex-col items-center justify-center gap-4 px-0">
              <form onSubmit={sendChatMessage} className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-[#1A1A1A] py-2 pl-5 pr-2 shadow-2xl">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-zinc-500 hover:text-white" aria-label="Attach file">
                  <Paperclip className="h-[18px] w-[18px]" />
                </button>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Message or ask Beatrice..."
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-zinc-600"
                />
                <button type="submit" disabled={!chatInput.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40" title="Send message">
                  <Send className="h-[18px] w-[18px]" />
                </button>
              </form>

              <div className="flex w-full items-center justify-around rounded-full border border-white/10 bg-[#1A1A1A] px-4 py-3 shadow-2xl">
                <button 
                  onClick={() => setIsMuted(p => !p)} 
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-[13px] transition-all ${isMuted ? 'border-red-500/30 bg-red-500/10 text-red-500' : 'border-white/10 bg-[#0A0A0B] text-zinc-400 hover:border-white/30 hover:text-white'}`}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}<span className="text-[13px]">Mic</span>
                </button>
                
                {!isActive ? ( 
                  <StartIconMicVisualizer 
                    isActive={false} 
                    connecting={connecting} 
                    isMuted={isMuted} 
                    micLevel={0} 
                    micBands={micBands} 
                    onClick={startSession} 
                  /> 
                ) : ( 
                  <StartIconMicVisualizer 
                    isActive={true} 
                    connecting={connecting} 
                    isMuted={isMuted} 
                    micLevel={micLevel} 
                    micBands={micBands} 
                    onClick={stopSession} 
                  /> 
                )}
                
                <button 
                  onClick={() => toggleVideo()} 
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-[13px] transition-all ${isVideoEnabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-white/10 bg-[#0A0A0B] text-zinc-400 hover:border-white/30 hover:text-white'}`}
                >
                  {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}<span className="text-[13px]">Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSidebar(true)}
                  className="flex items-center gap-2 rounded-full px-3 py-2 text-[13px] text-zinc-400 transition hover:text-white"
                >
                  <Cast className="h-4 w-4" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      <AnimatePresence>
        {activeTaskPage && !isVideoEnabled && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[120] flex items-stretch justify-center text-white"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.72), rgba(0,0,0,0.48) 42%, rgba(0,0,0,0.84))',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="mx-auto flex w-full max-w-[360px] flex-col overflow-auto rounded-[30px] border border-white/[0.16] p-5"
              style={{
                background: 'linear-gradient(180deg, rgba(22,22,34,0.94), rgba(6,6,12,0.94))',
                boxShadow: '0 28px 80px rgba(0,0,0,0.65)',
                minHeight: '58vh',
                maxHeight: '100%',
              }}
            >
              <div className="flex flex-col gap-3">
                {activeTaskPage.status === 'processing' && (
                  <div className="flex min-h-[80px] items-center justify-center gap-[9px]">
                    <span className="h-[14px] w-[14px] animate-pulse rounded-full bg-[#6366f1]" />
                    <span className="h-[14px] w-[14px] animate-pulse rounded-full bg-[#6366f1] [animation-delay:0.15s]" />
                    <span className="h-[14px] w-[14px] animate-pulse rounded-full bg-[#6366f1] [animation-delay:0.3s]" />
                  </div>
                )}

                {activeTaskPage.result && (
                  <div className="rounded-[20px] border border-white/[0.08] bg-[#0A0A0B]/60 p-4">
                    <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-200">{activeTaskPage.result}</p>
                  </div>
                )}

                {activeTaskPage.htmlPreviewData && (
                  <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-white">
                    <iframe title={activeTaskPage.htmlPreviewFilename || 'Generated artifact'} src={activeTaskPage.htmlPreviewData} className="h-[50vh] w-full bg-white" />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  {activeTaskPage.htmlPreviewData && (
                    <button
                      onClick={() => setLivePreview({ data: activeTaskPage.htmlPreviewData!, filename: activeTaskPage.htmlPreviewFilename || 'artifact.html' })}
                      className="flex items-center justify-center gap-2 rounded-full border border-lime-300/30 bg-lime-300/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-lime-200 transition hover:bg-lime-300/20"
                    >
                      <ExternalLink className="h-4 w-4" /> Full Screen
                    </button>
                  )}
                  {activeTaskPage.htmlPreviewData && (
                    <a href={activeTaskPage.htmlPreviewData} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/10">
                      <ExternalLink className="h-4 w-4" /> Open
                    </a>
                  )}
                  {activeTaskPage.downloadData && activeTaskPage.downloadFilename && (
                    <a href={activeTaskPage.downloadData} download={activeTaskPage.downloadFilename} className="flex items-center justify-center gap-2 rounded-full bg-[#6366f1] px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-[#5558E0]">
                      <Download className="h-4 w-4" /> Download
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
      </div>

      {!isVideoEnabled && !showProfile && !showSettings && (
        <div className="shrink-0 flex justify-center px-0 pt-[15px] pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="flex w-full max-w-[430px] flex-col gap-5 px-5">
            {showToolConfirm && (
              <div className="flex w-full items-center gap-3 rounded-[20px] border border-lime-300/20 bg-lime-300/5 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
                <span className="flex-1 pl-2 text-[13px] text-lime-200">
                  {settings.agentName} wants to run an action. Go ahead?
                </span>
                <button
                  type="button"
                  onClick={executePendingTools}
                  className="flex items-center gap-1.5 rounded-full bg-lime-300 px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-lime-200"
                >
                  <Check className="h-4 w-4" /> Yes
                </button>
                <button
                  type="button"
                  onClick={cancelPendingTools}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[13px] font-medium text-zinc-300 transition hover:bg-white/10"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              </div>
            )}
            <form onSubmit={sendChatMessage} className="flex w-full items-center gap-[15px] rounded-[30px] border border-white/10 bg-[#1c1c1e]/95 py-2 pl-5 pr-2 shadow-[0_20px_45px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[#9ca3af] hover:text-white transition" aria-label="Attach file">
                <Paperclip className="h-[18px] w-[18px]" />
              </button>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message or ask Beatrice..."
                className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-[#666]"
              />
              <button type="submit" disabled={!chatInput.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4f46e5] text-white transition hover:bg-[#6366f1] disabled:opacity-40" title="Send message">
                <Send className="h-[16px] w-[16px]" />
              </button>
            </form>

            <div className="flex w-full items-center justify-around rounded-[30px] border border-white/10 bg-[#1c1c1e]/95 p-3 shadow-[0_20px_45px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted(p => !p)}
                  className={`flex items-center gap-2 rounded-full px-2 py-1 text-[13px] font-medium transition-all ${isMuted ? 'text-red-500' : 'text-[#9ca3af] hover:text-white'}`}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  <span>Mic</span>
                </button>
                <div className="h-6 w-10">
                  <HeaderMicVisualizer
                    isActive={isActive}
                    isMuted={isMuted}
                    micLevel={micLevel}
                    micBands={micBands}
                  />
                </div>
              </div>
              <button 
                onClick={() => toggleVideo()} 
                className={`flex items-center gap-2 rounded-full px-2 py-1 text-[13px] font-medium transition-all ${isVideoEnabled ? 'text-emerald-500' : 'text-[#9ca3af] hover:text-white'}`}
                title="Toggle camera"
              >
                {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                <span>Camera</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSidebar(true)}
                className="flex items-center gap-2 rounded-full px-2 py-1 text-[13px] font-medium text-[#9ca3af] transition hover:text-white"
              >
                <Cast className="h-4 w-4" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowSidebar(false)} 
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" 
            />
            
            <motion.div 
              initial={{ x: '-100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '-100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
              className="fixed bottom-0 left-0 top-0 z-[101] flex w-96 max-w-[88vw] flex-col border-r border-white/10 bg-[#0A0A0B] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 p-6">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white">Office History</h2>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">Saved conversation records</p>
                </div>
                <button 
                  onClick={() => setShowSidebar(false)} 
                  className="-mr-2 rounded-xl p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                  title="Close sidebar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 border-b border-white/10 p-4">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-lime-300/20 bg-lime-300/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-lime-200 transition hover:bg-lime-300/15"
                >
                  <Paperclip className="h-4 w-4" /> Attach
                </button>
                
                <button 
                  onClick={() => setChatInput('Build ')} 
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-200 transition hover:bg-white/10"
                  title="Quick build prompt"
                >
                  <Code2 className="h-4 w-4" /> Build
                </button>
                
                <button 
                  onClick={() => { setShowSidebar(false); setShowMeetingRecorder(true); }} 
                  className="col-span-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-sky-300 transition hover:bg-sky-400/20"
                >
                  <Mic className="h-4 w-4" /> Record Meeting & Analyze
                </button>
              </div>

              {/* Document Generation Skills */}
              <div className="border-b border-white/10 px-4 py-4">
                <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500">
                  Document Generation
                </p>
                <div className="grid max-h-[34dvh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:max-h-[42dvh]">
                  {DOCUMENT_SKILLS.map(({ label, icon: Icon, border, bg, text, hover, prompt }) => (
                    <button
                      key={label}
                      onClick={() => {
                        setShowSidebar(false);
                        const tid = `doc-${Date.now()}`;
                        const task: ActionTask = {
                          id: tid,
                          serviceName: label,
                          action: prompt,
                          status: 'processing',
                          result: `${settings.agentName} is generating your ${label.toLowerCase()} now through the live audio session.`,
                        };
                        setActiveTaskPage(task);
                        setTasks(p => [task, ...p.filter(t => t.status === 'processing').slice(0, 2)]);
                        (async () => {
                          try {
                            if (!sessionRef.current) {
                              await startSession();
                              await new Promise(resolve => setTimeout(resolve, 900));
                            }
                            if (sessionRef.current) {
                              sendTurnToLive(`${settings.userName} tapped the "${label}" button. Say "OK, I'll get that started right away" warmly and keep the conversation going.`);
                            }
                            await runWorkerAgent(prompt, label);
                          } catch (err) {
                            console.error(err);
                          }
                        })();
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border ${border} ${bg} px-2.5 py-2.5 text-[9px] font-bold uppercase tracking-widest ${text} transition ${hover}`}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image & Video Generation Skills */}
              <div className="border-b border-white/10 px-4 py-4">
                <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500">
                  Image & Video Generation
                </p>
                <div className="grid max-h-[34dvh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:max-h-[42dvh]">
                  <button
                    onClick={() => {
                      setShowSidebar(false);
                      setChatInput('Generate a stunning professional image for me');
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-pink-400/30 bg-pink-400/10 px-2.5 py-2.5 text-[9px] font-bold uppercase tracking-widest text-pink-200 transition hover:bg-pink-400/20"
                  >
                    <Image className="h-3 w-3" />
                    Generate Image
                  </button>
                  <button
                    onClick={() => {
                      setShowSidebar(false);
                      setChatInput('Create a professional 12-second product showcase video');
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-purple-400/30 bg-purple-400/10 px-2.5 py-2.5 text-[9px] font-bold uppercase tracking-widest text-purple-200 transition hover:bg-purple-400/20"
                  >
                    <Film className="h-3 w-3" />
                    Generate Video
                  </button>
                  <button
                    onClick={() => {
                      setShowSidebar(false);
                      setChatInput('Create a professional video with AI avatar for product announcement');
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-2.5 text-[9px] font-bold uppercase tracking-widest text-cyan-200 transition hover:bg-cyan-400/20"
                  >
                    <Video className="h-3 w-3" />
                    AI Avatar Video
                  </button>
                  <button
                    onClick={() => {
                      setShowSidebar(false);
                      setChatInput('Enhance my prompt and create amazing AI-generated art');
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-orange-400/30 bg-orange-400/10 px-2.5 py-2.5 text-[9px] font-bold uppercase tracking-widest text-orange-200 transition hover:bg-orange-400/20"
                  >
                    <Palette className="h-3 w-3" />
                    AI Art
                  </button>
                  <button
                    onClick={() => {
                      setShowSidebar(false);
                      setChatInput('Create an impressive product demo video');
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-2.5 py-2.5 text-[9px] font-bold uppercase tracking-widest text-amber-200 transition hover:bg-amber-400/20"
                  >
                    <Wand2 className="h-3 w-3" />
                    Product Demo
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="chat-scroll-container flex-1 space-y-3 p-4 pb-3">
                  {historyMsgs.map((msg, i) => (
                    <div 
                      key={`${msg.timestamp}-${i}`} 
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <span className="mb-1 text-[8px] uppercase tracking-widest text-zinc-600">
                        {msg.role === 'user' ? settings.userName : settings.agentName}
                      </span>
                      
                      <div 
                        className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed overflow-hidden break-words whitespace-pre-wrap ${
                          msg.role === 'user' 
                            ? 'rounded-tr-sm border border-sky-400/20 bg-sky-400/10 text-sky-100' 
                            : 'rounded-tl-sm border border-lime-300/10 bg-white/5 text-zinc-300'
                        }`}
                      >
                        
                        {msg.fileDataUrl && (
                          <div className="mb-2 flex w-full justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
                            <img 
                              src={msg.fileDataUrl} 
                              alt="Preview" 
                              className="max-h-48 w-auto object-contain" 
                            />
                          </div>
                        )}
                        
                        {msg.fileName && ( 
                          <div className="mb-2 flex items-center gap-2 rounded-xl bg-black/30 px-2 py-1 text-[10px] text-lime-200">
                            <Upload className="h-3 w-3" />
                            {msg.fileName}
                          </div> 
                        )}
                        
                        {msg.toolName && (
                          <div className="mb-3 flex items-center gap-2 rounded-xl bg-lime-300/10 px-2 py-1 text-[10px] text-lime-200">
                            <FileText className="h-3 w-3" />
                            {msg.toolName}
                          </div>
                        )}

                        {!msg.toolName && !msg.htmlPreviewData && !msg.downloadData && msg.text}

                        {msg.htmlPreviewData && msg.htmlPreviewFilename && (
                          <>
                            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white shadow-lg">
                              <iframe title={msg.htmlPreviewFilename} src={msg.htmlPreviewData} className="h-[50vh] w-full bg-white" />
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <button
                                onClick={() => setLivePreview({ data: msg.htmlPreviewData!, filename: msg.htmlPreviewFilename! })}
                                className="flex items-center justify-center gap-2 rounded-xl border border-lime-300/20 bg-lime-300/10 px-3 py-3 text-[11px] font-bold uppercase tracking-widest text-lime-200 transition hover:bg-lime-300/15"
                              >
                                <Eye className="h-4 w-4" />
                                <span>Preview</span>
                              </button>
                              <a
                                href={msg.htmlPreviewData}
                                download={msg.htmlPreviewFilename}
                                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-200 transition hover:bg-white/10"
                              >
                                <Download className="h-4 w-4" />
                                <span>Download</span>
                              </a>
                            </div>
                          </>
                        )}

                        {msg.downloadData && msg.downloadFilename && (
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <a
                              href={msg.downloadData}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-center gap-2 rounded-xl border border-lime-300/20 bg-lime-300/10 px-3 py-3 text-[11px] font-bold uppercase tracking-widest text-lime-200 transition hover:bg-lime-300/15"
                            >
                              <Eye className="h-4 w-4" />
                              <span>View</span>
                            </a>
                            <a
                              href={msg.downloadData}
                              download={msg.downloadFilename}
                              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-200 transition hover:bg-white/10"
                            >
                              <Download className="h-4 w-4" />
                              <span>Download</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {historyMsgs.length === 0 && ( 
                    <div className="py-10 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                      No Office History Yet
                    </div> 
                  )}
                </div>
                
                <form 
                  onSubmit={sendChatMessage} 
                  className="border-t border-white/10 bg-[#070807]/95 p-3 backdrop-blur-xl"
                >
                  <div className="flex items-center gap-2 rounded-2xl border border-lime-300/15 bg-black/45 p-2 shadow-2xl">
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition hover:border-lime-300/30 hover:text-lime-200"
                      title="Attach file"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    
                    <input 
                      value={chatInput} 
                      onChange={(e) => setChatInput(e.target.value)} 
                      placeholder={`Message ${settings.agentName}...`} 
                      className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-zinc-600" 
                      style={{ fontFamily: 'Roboto, system-ui, sans-serif' }} 
                    />
                    
                    <button 
                      type="submit" 
                      disabled={!chatInput.trim()} 
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-300 text-black transition hover:bg-lime-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="eburon-fullscreen-page fixed inset-0 z-[250] h-[100dvh] w-screen bg-black"
            style={{
              background: 'radial-gradient(circle at 15% 0%, rgba(99,102,241,0.35) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(139,92,246,0.28) 0%, transparent 45%), radial-gradient(circle at 50% 50%, rgba(34,211,238,0.14) 0%, transparent 50%), #0a0a0f'
            }}
          >
            <div className="mx-auto flex h-full max-w-[430px] flex-col relative">
              <div className="absolute inset-x-0 top-0 z-[1] flex shrink-0 items-center justify-between px-5 pt-[env(safe-area-inset-top,10px)] pb-4 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
                <button
                  onClick={() => setShowProfile(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white transition hover:bg-white/[0.12] active:scale-[0.92]"
                  title="Close profile"
                >
                  <X className="h-5 w-5" />
                </button>
                <h2 className="text-[18px] font-bold text-white">Profile</h2>
                <button
                  onClick={persistSettings}
                  className="rounded-full bg-[#6366f1] px-[18px] py-[9px] text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(99,102,241,0.4)] transition hover:bg-[#5558E0] active:scale-[0.96]"
                >
                  Save
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-5 pt-[calc(env(safe-area-inset-top,10px)+4rem+1rem)]">
                <div className="flex flex-col gap-[18px]">
                <div className="relative flex flex-col items-center gap-[10px] overflow-hidden py-10">
                  <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-[55%] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.35)_0%,rgba(139,92,246,0.15)_40%,transparent_70%)] blur-[40px]" />
                  <div className="relative z-[1] h-[120px] w-[120px]">
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#22D3EE] blur-[6px] opacity-80" />
                    <div className="absolute -inset-[2px] rounded-full bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#22D3EE]" />
                    <div className="relative h-full w-full overflow-hidden rounded-full bg-[#1a1a24] shadow-[0_12px_32px_rgba(0,0,0,0.5),inset_0_0_0_3px_rgba(0,0,0,0.4)]">
                      {settings.avatarUrl || user.photoURL ? (
                        <img
                          src={settings.avatarUrl || user.photoURL || ''}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : null}
                      {(!settings.avatarUrl && !user.photoURL) && (
                        <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-zinc-700">{settings.userName?.[0] || 'U'}</div>
                      )}
                    </div>
                    <button title="Change avatar" aria-label="Change avatar" className="absolute -bottom-[2px] -right-[2px] z-[2] flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-white shadow-[0_4px_14px_rgba(99,102,241,0.45)] ring-[3px] ring-[#000000] transition hover:scale-[1.08] hover:shadow-[0_6px_20px_rgba(99,102,241,0.6)] active:scale-95">
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 z-[3] cursor-pointer opacity-0"
                      aria-label="Upload profile picture"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const img = document.createElement('img');
                          img.onload = () => {
                            const c = document.createElement('canvas');
                            c.width = 150; c.height = 150;
                            const ctx = c.getContext('2d');
                            if (!ctx) return;
                            ctx.drawImage(img, 0, 0, 150, 150);
                            setSettings(s => ({ ...s, avatarUrl: c.toDataURL('image/jpeg', 0.8) }));
                          };
                          img.src = ev.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </div>
                  <div className="z-[1] text-[22px] font-bold tracking-[-0.3px] text-white">{settings.userName || user.displayName || 'Jo Lernout'}</div>
                  <div className="z-[1] text-[13px] text-white/50">{user.email || 'codexxxhost@gmail.com'}</div>
                </div>

                <div className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.035] shadow-[0_8px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[16px]">
                  <div className="flex items-center gap-3 px-[14px] py-3">
                    <div className="flex min-w-[110px] items-center gap-[10px] text-[13px] font-medium text-zinc-400">
                      <UserRound className="h-4 w-4 text-[rgba(99,102,241,0.85)]" />
                      <span>Display name</span>
                    </div>
                    <input
                      type="text"
                      value={settings.userName}
                      onChange={(e) => setSettings(s => ({ ...s, userName: e.target.value }))}
                      className="min-w-0 flex-1 bg-transparent text-right text-[14px] text-white outline-none placeholder:text-[rgba(156,163,175,0.45)]"
                      placeholder="Add"
                    />
                  </div>
                  <div className="border-t border-white/[0.05]" />
                  <div className="flex items-center gap-3 px-[14px] py-3">
                    <div className="flex min-w-[110px] items-center gap-[10px] text-[13px] font-medium text-zinc-400">
                      <Mail className="h-4 w-4 text-[rgba(99,102,241,0.85)]" />
                      <span>Email</span>
                    </div>
                    <input
                      type="email"
                      value={user.email || ''}
                      readOnly
                      className="min-w-0 flex-1 bg-transparent text-right text-[14px] text-zinc-400 outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[16px]">
                  <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.4px] text-zinc-400">
                    <span className="text-[rgba(99,102,241,0.85)]">Bio</span>
                  </div>
                  <textarea
                    value={settings.personality}
                    onChange={(e) => setSettings(s => ({ ...s, personality: e.target.value }))}
                    placeholder="A short line about you — the agent uses this for context."
                    rows={3}
                    className="min-h-[60px] w-full bg-transparent text-[14px] leading-[1.5] text-white outline-none placeholder:text-[rgba(156,163,175,0.4)]"
                  />
                </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-white/[0.06] bg-black/25 px-5 py-[14px] backdrop-blur-[20px]">
                <button
                  onClick={onLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-red-500/[0.4] bg-red-500/[0.12] py-[14px] text-[14px] font-semibold tracking-[0.2px] text-[#fca5a5] transition hover:bg-red-500/[0.24] hover:shadow-[0_4px_18px_rgba(239,68,68,0.3)] active:scale-[0.97]"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="eburon-fullscreen-page fixed inset-0 z-[250] h-[100dvh] w-screen bg-black"
            style={{
              background: 'radial-gradient(circle at 15% 0%, rgba(99,102,241,0.35) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(139,92,246,0.28) 0%, transparent 45%), radial-gradient(circle at 50% 50%, rgba(34,211,238,0.14) 0%, transparent 50%), #0a0a0f'
            }}
          >
            <div className="mx-auto flex h-full max-w-[430px] flex-col relative">
              <div className="absolute inset-x-0 top-0 z-[1] flex shrink-0 items-center justify-between px-5 pt-[env(safe-area-inset-top,10px)] pb-4 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white transition hover:bg-white/[0.12] active:scale-[0.92]"
                  title="Close settings"
                >
                  <X className="h-5 w-5" />
                </button>
                <h2 className="text-[18px] font-bold text-white">Settings</h2>
                <button
                  onClick={persistSettings}
                  className="rounded-full bg-[#6366f1] px-[18px] py-[9px] text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(99,102,241,0.4)] transition hover:bg-[#5558E0] active:scale-[0.96]"
                >
                  Save
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-5 pt-[calc(env(safe-area-inset-top,10px)+4rem+1rem)]">
                <div className="flex flex-col gap-[22px]">
                <div className="flex flex-col gap-3 rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-[18px_16px_16px] shadow-[0_8px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[10px]">
                  <h3 className="flex items-center gap-[10px] text-[15px] font-bold text-white">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] text-white shadow-[0_4px_10px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.25)]">
                      <UserRound className="h-[18px] w-[18px]" />
                    </span>
                    Persona
                  </h3>
                  <p className="text-[12.5px] leading-[1.4] text-zinc-400">Tell your agent who you are and how you want to be addressed.</p>
                  <label className="flex flex-col gap-[6px]">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.4px] text-zinc-400">Your name</span>
                    <input
                      type="text"
                      value={settings.userName}
                      onChange={(e) => setSettings(s => ({ ...s, userName: e.target.value }))}
                      placeholder="What should I call you?"
                      className="w-full rounded-[14px] border border-white/[0.08] bg-black/[0.3] px-[14px] py-3 text-[14px] text-white outline-none transition focus:border-[rgba(99,102,241,0.6)] focus:bg-black/[0.4] placeholder:text-[rgba(156,163,175,0.6)]"
                    />
                  </label>
                  <label className="flex flex-col gap-[6px]">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.4px] text-zinc-400">Agent name</span>
                    <input
                      type="text"
                      value={settings.agentName}
                      onChange={(e) => setSettings(s => ({ ...s, agentName: e.target.value }))}
                      placeholder="e.g. Beatrice, Aria, Nova..."
                      className="w-full rounded-[14px] border border-white/[0.08] bg-black/[0.3] px-[14px] py-3 text-[14px] text-white outline-none transition focus:border-[rgba(99,102,241,0.6)] focus:bg-black/[0.4] placeholder:text-[rgba(156,163,175,0.6)]"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3 rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-[18px_16px_16px] shadow-[0_8px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[10px]">
                  <h3 className="flex items-center gap-[10px] text-[15px] font-bold text-white">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#FF6B9A] to-[#FF4D7E] text-white shadow-[0_4px_10px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.25)]">
                      <Bot className="h-[18px] w-[18px]" />
                    </span>
                    Behavior
                  </h3>
                  <p className="text-[12.5px] leading-[1.4] text-zinc-400">How should the agent interact with you? Tone, style, quirks — anything goes.</p>
                  <label className="flex flex-col gap-[6px]">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.4px] text-zinc-400">Persona &amp; tone</span>
                    <textarea
                      value={settings.personality}
                      onChange={(e) => setSettings(s => ({ ...s, personality: e.target.value }))}
                      placeholder="e.g. Warm, witty, and concise. Speaks like a thoughtful friend."
                      rows={5}
                      className="min-h-[110px] w-full resize-none rounded-[14px] border border-white/[0.08] bg-black/[0.3] px-[14px] py-3 text-[14px] leading-[1.5] text-white outline-none transition focus:border-[rgba(99,102,241,0.6)] focus:bg-black/[0.4] placeholder:text-[rgba(156,163,175,0.6)]"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['warm', 'professional', 'playful', 'concise'] as const).map(preset => (
                      <button
                        key={preset}
                        onClick={() => {
                          const map: Record<string, string> = {
                            warm: 'Warm, friendly, and empathetic. Speaks like a trusted colleague.',
                            professional: 'Formal, precise, and efficient. Focuses on clear business communication.',
                            playful: 'Lighthearted, witty, and creative. Enjoys a good metaphor.',
                            concise: 'Brief, direct, and to the point. No fluff, just facts.',
                          };
                          setSettings(s => ({ ...s, personality: map[preset] }));
                        }}
                        className="rounded-full border border-white/[0.08] bg-white/[0.05] px-[14px] py-[7px] text-[12px] font-medium text-white transition hover:border-[rgba(99,102,241,0.5)] hover:bg-[rgba(99,102,241,0.15)]"
                      >
                        {preset.charAt(0).toUpperCase() + preset.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-[18px_16px_16px] shadow-[0_8px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[10px]">
                  <h3 className="flex items-center gap-[10px] text-[15px] font-bold text-white">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#22D3EE] to-[#0EA5E9] text-white shadow-[0_4px_10px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.25)]">
                      <BookOpen className="h-[18px] w-[18px]" />
                    </span>
                    Knowledge Base
                  </h3>
                  <p className="text-[12.5px] leading-[1.4] text-zinc-400">Upload documents your agent can reference in conversations.</p>
                  <button
                    onClick={() => knowledgeBaseInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-[12px] bg-white/[0.05] px-4 py-[11px] text-[14px] font-medium text-white transition hover:bg-white/[0.08]"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload files</span>
                  </button>
                  {settings.knowledgeBase && (
                    <div className="mt-1 text-[10px] font-mono text-lime-200/70">
                      Stored: {settings.knowledgeBase.length.toLocaleString()} characters
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSkills && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="eburon-fullscreen-page fixed inset-0 z-[250] h-[100dvh] w-screen bg-black"
            style={{
              background: 'radial-gradient(circle at 15% 0%, rgba(99,102,241,0.35) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(139,92,246,0.28) 0%, transparent 45%), radial-gradient(circle at 50% 50%, rgba(34,211,238,0.14) 0%, transparent 50%), #0a0a0f'
            }}
          >
            <div className="mx-auto flex h-full max-w-[430px] flex-col relative">
              <div className="absolute inset-x-0 top-0 z-[1] flex shrink-0 items-center justify-between px-5 pt-[env(safe-area-inset-top,10px)] pb-4 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
                <button
                  onClick={() => setShowSkills(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white transition hover:bg-white/[0.12] active:scale-[0.92]"
                  title="Close skills"
                >
                  <X className="h-5 w-5" />
                </button>
                <h2 className="text-[18px] font-bold text-white">Skills</h2>
                <div className="w-10" />
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-5 pt-[calc(env(safe-area-inset-top,10px)+4rem+1rem)]">
                <div className="grid grid-cols-3 gap-4">
                  {referenceShortcuts.filter(s => s.label !== 'Profile' && s.label !== 'Settings' && s.label !== 'Skills').map(({ label, icon: Icon, tone, prompt }) => (
                    <button
                      key={label}
                      onClick={() => {
                        runReferenceShortcut(label, prompt);
                        setShowSkills(false);
                      }}
                      className="flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[10px] transition hover:bg-white/[0.06] hover:border-white/[0.12] active:scale-[0.98]"
                    >
                      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.25)]`}>
                        <Icon className="h-8 w-8" />
                      </div>
                      <span className="text-[15px] font-medium text-white">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen live artifact preview */}
      <AnimatePresence>
        {livePreview && (
          <LiveArtifactPreview
            data={livePreview.data}
            filename={livePreview.filename}
            onClose={() => setLivePreview(null)}
            onDownload={() => {
              const a = document.createElement('a');
              a.href = livePreview.data;
              a.download = livePreview.filename;
              a.click();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
