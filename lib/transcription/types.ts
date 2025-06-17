export interface VideoMetadata {
  url: string;
  platform: 'tiktok' | 'instagram';
  id: string;
  description?: string;
  duration?: number;
  size?: number;
}

export interface TranscriptionRequest {
  videos: VideoMetadata[];
  options?: TranscriptionOptions;
}

export interface TranscriptionOptions {
  includeVisualDescriptions?: boolean;
  language?: string;
  model?: 'gemini-2.0-flash' | 'gemini-2.5-flash-preview' | 'gemini-2.5-pro-preview';
  extractMarketingSegments?: boolean; // New option for marketing analysis
  fastMode?: boolean; // Optimize for speed over detailed analysis
}

export interface MarketingSegments {
  Hook: string;
  Bridge: string;
  "Golden Nugget": string;
  WTA: string;
}

export interface WordAssignment {
  word: string;
  category: 'Hook' | 'Bridge' | 'Golden Nugget' | 'WTA';
  position: number;
}

export interface ScriptTemplate {
  hook: string;
  bridge: string;
  nugget: string;
  wta: string;
}

export interface TranscriptionResult {
  videoId: string;
  videoUrl: string;
  platform: string;
  transcription: string;
  visualDescription?: string;
  marketingSegments?: MarketingSegments;
  wordAssignments?: WordAssignment[];
  scriptTemplate?: ScriptTemplate;
  processingTime: number;
  success: boolean;
  error?: string;
  metadata?: {
    viewCount?: number;
    likeCount?: number;
    quality?: string;
    fileSize?: number;
  };
}

export interface DownloadedVideo {
  buffer: Buffer;
  mimeType: string;
  size: number;
  metadata: VideoMetadata;
}

export interface GeminiResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface TranscriptionJobResult {
  success: boolean;
  results: TranscriptionResult[];
  totalProcessed: number;
  totalFailed: number;
  processingTime: number;
  errors: Array<{
    videoId: string;
    error: string;
  }>;
}

export interface TrainingExample {
  input: string;
  output: string;
  metadata?: {
    videoId?: string;
    platform?: string;
    topic?: string;
    type?: 'original' | 'synthetic';
    viewCount?: number;
    likeCount?: number;
  };
}

export interface TrainingDataset {
  examples: TrainingExample[];
  summary: {
    totalExamples: number;
    originalExamples: number;
    syntheticExamples: number;
    topics: string[];
    platforms: string[];
  };
  metadata?: {
    createdAt: string;
    version: string;
    originalExamples?: number;
    syntheticExamples?: number;
    processingTime?: number;
  };
} 