// Main service
export { TranscriptionService } from './transcription-service';

// Individual modules
export { VideoDownloader, VideoDownloadError } from './video-downloader';
export { GeminiClient, GeminiTranscriptionError } from './gemini-client';
export { TemplateGenerator } from './template-generator';
export { TrainingDataExporter } from './training-data-exporter';

// Types
export type {
  VideoMetadata,
  TranscriptionRequest,
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionJobResult,
  DownloadedVideo,
  GeminiResponse,
  ScriptTemplate,
  MarketingSegments,
  WordAssignment
} from './types';

// Training data types
export type {
  TrainingExample,
  TrainingDataset,
  ExportOptions
} from './training-data-exporter'; 