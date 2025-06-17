import { VideoMetadata, DownloadedVideo } from './types';

export class VideoDownloadError extends Error {
  constructor(
    message: string,
    public videoId: string,
    public videoUrl: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'VideoDownloadError';
  }
}

export class VideoDownloader {
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly TIMEOUT_MS = 30000; // 30 seconds
  private static readonly SUPPORTED_MIME_TYPES = [
    'video/mp4',
    'video/mpeg',
    'video/mov',
    'video/avi',
    'video/x-flv',
    'video/mpg',
    'video/webm',
    'video/wmv',
    'video/3gpp'
  ];

  /**
   * Download a single video from URL
   */
  static async downloadVideo(metadata: VideoMetadata): Promise<DownloadedVideo> {
    const startTime = Date.now();
    
    try {
      console.log(`[VideoDownloader] Starting download for ${metadata.platform} video: ${metadata.id}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(metadata.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > this.MAX_FILE_SIZE) {
        throw new Error(`File too large: ${contentLength} bytes (max: ${this.MAX_FILE_SIZE})`);
      }

      const contentType = response.headers.get('content-type') || 'video/mp4';
      const mimeType = this.validateMimeType(contentType);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > this.MAX_FILE_SIZE) {
        throw new Error(`Downloaded file too large: ${buffer.length} bytes (max: ${this.MAX_FILE_SIZE})`);
      }

      const downloadTime = Date.now() - startTime;
      console.log(`[VideoDownloader] Successfully downloaded ${metadata.id}: ${buffer.length} bytes in ${downloadTime}ms`);

      return {
        buffer,
        mimeType,
        size: buffer.length,
        metadata
      };

    } catch (error) {
      const downloadTime = Date.now() - startTime;
      console.error(`[VideoDownloader] Failed to download ${metadata.id} after ${downloadTime}ms:`, error);
      
      throw new VideoDownloadError(
        `Failed to download video: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata.id,
        metadata.url,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Download multiple videos with error handling
   */
  static async downloadVideos(videos: VideoMetadata[]): Promise<{
    successful: DownloadedVideo[];
    failed: Array<{ metadata: VideoMetadata; error: VideoDownloadError }>;
  }> {
    console.log(`[VideoDownloader] Starting batch download of ${videos.length} videos`);
    
    const successful: DownloadedVideo[] = [];
    const failed: Array<{ metadata: VideoMetadata; error: VideoDownloadError }> = [];

    // Process videos sequentially to avoid overwhelming the server
    for (const video of videos) {
      try {
        const downloaded = await this.downloadVideo(video);
        successful.push(downloaded);
        
        // Add small delay between downloads to be respectful
        await this.delay(1000);
        
      } catch (error) {
        const downloadError = error instanceof VideoDownloadError 
          ? error 
          : new VideoDownloadError(
              `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              video.id,
              video.url,
              error instanceof Error ? error : undefined
            );
        
        failed.push({ metadata: video, error: downloadError });
      }
    }

    console.log(`[VideoDownloader] Batch download complete: ${successful.length} successful, ${failed.length} failed`);
    
    return { successful, failed };
  }

  /**
   * Convert downloaded video to base64 for Gemini API
   */
  static videoToBase64(video: DownloadedVideo): string {
    return video.buffer.toString('base64');
  }

  /**
   * Validate and normalize MIME type
   */
  private static validateMimeType(contentType: string): string {
    const mimeType = contentType.split(';')[0].trim().toLowerCase();
    
    if (this.SUPPORTED_MIME_TYPES.includes(mimeType)) {
      return mimeType;
    }
    
    // Default to mp4 if unsupported or unknown
    console.warn(`[VideoDownloader] Unsupported MIME type: ${mimeType}, defaulting to video/mp4`);
    return 'video/mp4';
  }

  /**
   * Simple delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get human-readable file size
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
} 