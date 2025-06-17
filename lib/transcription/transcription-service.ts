import { VideoDownloader, VideoDownloadError } from './video-downloader';
import { GeminiClient, GeminiTranscriptionError } from './gemini-client';
import { TemplateGenerator, ScriptTemplate } from './template-generator';
import { 
  VideoMetadata, 
  TranscriptionRequest, 
  TranscriptionResult, 
  TranscriptionJobResult,
  TranscriptionOptions,
  MarketingSegments,
  WordAssignment
} from './types';

export class TranscriptionService {
  private geminiClient: GeminiClient;
  private templateGenerator: TemplateGenerator;

  constructor(geminiApiKey?: string) {
    this.geminiClient = new GeminiClient(geminiApiKey);
    this.templateGenerator = new TemplateGenerator(geminiApiKey);
  }

  /**
   * Main method to process video transcription requests
   */
  async processTranscriptionRequest(request: TranscriptionRequest): Promise<TranscriptionJobResult> {
    const startTime = Date.now();
    const { videos, options = {} } = request;
    
    console.log(`[TranscriptionService] Starting transcription job for ${videos.length} videos`);
    
    try {
      // Step 1: Download videos
      console.log(`[TranscriptionService] Step 1: Downloading ${videos.length} videos`);
      const downloadResult = await VideoDownloader.downloadVideos(videos);
      
      if (downloadResult.successful.length === 0) {
        console.error(`[TranscriptionService] No videos downloaded successfully`);
        return this.createFailedJobResult(
          videos,
          downloadResult.failed.map(f => ({ videoId: f.metadata.id, error: f.error.message })),
          Date.now() - startTime
        );
      }

      console.log(`[TranscriptionService] Downloaded ${downloadResult.successful.length}/${videos.length} videos successfully`);

      // Step 2: Transcribe videos
      console.log(`[TranscriptionService] Step 2: Transcribing ${downloadResult.successful.length} videos`);
      const transcriptionResult = await this.geminiClient.transcribeVideos(
        downloadResult.successful,
        options
      );

      // Step 3: Process results
      const results: TranscriptionResult[] = [];
      const errors: Array<{ videoId: string; error: string }> = [];

      // Process successful transcriptions
      for (const { video, response } of transcriptionResult.successful) {
        const result = this.createTranscriptionResult(video.metadata, response.text, true, undefined, undefined, options);
        results.push(result);
      }

      // Process transcription failures
      for (const { video, error } of transcriptionResult.failed) {
        const result = this.createTranscriptionResult(video.metadata, '', false, error.message, undefined, options);
        results.push(result);
        errors.push({ videoId: video.metadata.id, error: error.message });
      }

      // Process download failures
      for (const { metadata, error } of downloadResult.failed) {
        const result = this.createTranscriptionResult(metadata, '', false, error.message, undefined, options);
        results.push(result);
        errors.push({ videoId: metadata.id, error: error.message });
      }

      const totalTime = Date.now() - startTime;
      const successfulCount = results.filter(r => r.success).length;
      const failedCount = results.length - successfulCount;

      console.log(`[TranscriptionService] Job completed in ${totalTime}ms: ${successfulCount} successful, ${failedCount} failed`);

      return {
        success: successfulCount > 0,
        results,
        totalProcessed: results.length,
        totalFailed: failedCount,
        processingTime: totalTime,
        errors
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[TranscriptionService] Job failed after ${totalTime}ms:`, error);
      
      return this.createFailedJobResult(
        videos,
        [{ videoId: 'all', error: error instanceof Error ? error.message : 'Unknown error' }],
        totalTime
      );
    }
  }

  /**
   * Process a single video for transcription
   */
  async transcribeSingleVideo(
    metadata: VideoMetadata, 
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[TranscriptionService] Processing single video: ${metadata.id} (${this.getProcessingMode(options)})`);
      
      // Download video
      const downloadedVideo = await VideoDownloader.downloadVideo(metadata);
      console.log(`[TranscriptionService] Downloaded video ${metadata.id}: ${VideoDownloader.formatFileSize(downloadedVideo.size)}`);
      
      // Transcribe video
      const response = await this.geminiClient.transcribeVideo(downloadedVideo, options);
      console.log(`[TranscriptionService] Transcribed video ${metadata.id} successfully`);
      
      return this.createTranscriptionResult(metadata, response.text, true, undefined, Date.now() - startTime, options);
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[TranscriptionService] Failed to process video ${metadata.id}:`, error);
      
      const errorMessage = error instanceof VideoDownloadError || error instanceof GeminiTranscriptionError
        ? error.message
        : `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      return this.createTranscriptionResult(metadata, '', false, errorMessage, processingTime, options);
    }
  }

  /**
   * Fast transcription mode - optimized for speed
   */
  async transcribeVideosFast(
    videos: VideoMetadata[],
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionJobResult> {
    // Force fast mode settings
    const fastOptions: TranscriptionOptions = {
      ...options,
      extractMarketingSegments: false,
      fastMode: true,
      includeVisualDescriptions: false
    };

    console.log(`[TranscriptionService] Starting FAST transcription job for ${videos.length} videos`);
    
    return this.processTranscriptionRequest({
      videos,
      options: fastOptions
    });
  }

  /**
   * Get processing mode description
   */
  private getProcessingMode(options: TranscriptionOptions): string {
    if (options.extractMarketingSegments) return 'Marketing Analysis';
    if (options.fastMode) return 'Fast Mode';
    return 'Standard';
  }

  /**
   * Validate transcription request
   */
  static validateRequest(request: TranscriptionRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!request.videos || !Array.isArray(request.videos)) {
      errors.push('Videos array is required');
    } else {
      if (request.videos.length === 0) {
        errors.push('At least one video is required');
      }
      
      if (request.videos.length > 50) {
        errors.push('Maximum 50 videos per request');
      }
      
      // Validate each video
      request.videos.forEach((video, index) => {
        if (!video.url) {
          errors.push(`Video ${index}: URL is required`);
        }
        
        if (!video.id) {
          errors.push(`Video ${index}: ID is required`);
        }
        
        if (!video.platform || !['tiktok', 'instagram'].includes(video.platform)) {
          errors.push(`Video ${index}: Platform must be 'tiktok' or 'instagram'`);
        }
        
        try {
          new URL(video.url);
        } catch {
          errors.push(`Video ${index}: Invalid URL format`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a transcription result object
   */
  private createTranscriptionResult(
    metadata: VideoMetadata,
    responseText: string,
    success: boolean,
    error?: string,
    processingTime?: number,
    options?: TranscriptionOptions
  ): TranscriptionResult {
    const result: TranscriptionResult = {
      videoId: metadata.id,
      videoUrl: metadata.url,
      platform: metadata.platform,
      transcription: '',
      processingTime: processingTime || 0,
      success,
    };
    
    if (error) {
      result.error = error;
      return result;
    }

    // Parse response based on whether marketing segments were requested
    if (success && responseText && options?.extractMarketingSegments) {
      const parsed = this.parseMarketingResponse(responseText);
      result.transcription = parsed.transcription;
      result.marketingSegments = parsed.marketingSegments;
      result.wordAssignments = parsed.wordAssignments;
    } else {
      // Standard transcription
      result.transcription = responseText;
    }
    
    return result;
  }

  /**
   * Parse marketing analysis response from Gemini
   */
  private parseMarketingResponse(responseText: string): {
    transcription: string;
    marketingSegments?: MarketingSegments;
    wordAssignments?: WordAssignment[];
  } {
    try {
      console.log('[TranscriptionService] Raw Gemini response:', responseText.substring(0, 500) + '...');
      
      // Clean up the response text - remove markdown code blocks and extra text
      let cleanedResponse = responseText;
      
      // Remove common prefixes that Gemini sometimes adds
      const prefixPatterns = [
        /^.*?(?:Okay, I'm ready to analyze this video and provide the JSON output\.).*?(?:\n|$)/i,
        /^.*?(?:I'm ready to analyze.*?and provide.*?JSON.*?output).*?(?:\n|$)/i,
        /^.*?(?:I'm ready to analyze|Here's the analysis|Let me analyze).*?(?:\n|$)/i,
        /^.*?(?:```json|```)/i,
        /^.*?(?:Okay,|Sure,|Here's|Let me).*?(?:\n|$)/i,
        /^.*?(?:Based on|Looking at|After analyzing).*?(?:\n|$)/i,
        /^.*?(?:The video|This video|I can see).*?(?:\n|$)/i
      ];
      
      for (const pattern of prefixPatterns) {
        cleanedResponse = cleanedResponse.replace(pattern, '');
      }
      
      // Remove trailing markdown and extra text
      cleanedResponse = cleanedResponse.replace(/```.*$/s, '');
      cleanedResponse = cleanedResponse.replace(/\n\s*Note:.*$/s, '');
      cleanedResponse = cleanedResponse.replace(/\n\s*Please.*$/s, '');
      
      // Remove everything before the first opening brace since response should start with {
      const firstBraceIndex = cleanedResponse.indexOf('{');
      if (firstBraceIndex > 0) {
        cleanedResponse = cleanedResponse.substring(firstBraceIndex);
        console.log('[TranscriptionService] Removed text before first opening brace');
      }
      
      cleanedResponse = cleanedResponse.trim();
      
      console.log('[TranscriptionService] Cleaned response:', cleanedResponse.substring(0, 300) + '...');
      
      // Try multiple JSON extraction methods
      let jsonString = '';
      
      // Method 1: Look for JSON wrapped in code blocks
      const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1];
        console.log('[TranscriptionService] Found JSON in code block');
      }
      
      // Method 2: Look for JSON object in cleaned response
      if (!jsonString) {
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
          console.log('[TranscriptionService] Found JSON in cleaned response');
        }
      }
      
      // Method 3: Look for JSON in original response
      if (!jsonString) {
        const originalJsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (originalJsonMatch) {
          jsonString = originalJsonMatch[0];
          console.log('[TranscriptionService] Found JSON in original response');
        }
      }
      
      if (jsonString) {
        try {
          // First try to parse the complete JSON
          const parsed = JSON.parse(jsonString);
          console.log('[TranscriptionService] Successfully parsed JSON');
          
          if (parsed.transcription && parsed.marketingSegments) {
            const result: any = {
              transcription: parsed.transcription,
              marketingSegments: parsed.marketingSegments
            };

            // Include word assignments if present and valid
            if (parsed.wordAssignments && Array.isArray(parsed.wordAssignments)) {
              result.wordAssignments = parsed.wordAssignments;
              
              // Validate word assignments
              const validationResult = this.validateWordAssignments(
                parsed.transcription, 
                parsed.marketingSegments, 
                parsed.wordAssignments
              );
              
              if (!validationResult.valid) {
                console.warn('[TranscriptionService] Word assignment validation failed:', validationResult.errors);
                // Still return the result but log the validation issues
              } else {
                console.log('[TranscriptionService] Word assignment validation passed');
              }
            }

            return result;
          } else {
            console.warn('[TranscriptionService] Parsed JSON missing required fields');
          }
        } catch (parseError) {
          console.error('[TranscriptionService] JSON parsing failed:', parseError);
          console.log('[TranscriptionService] Attempting to parse without word assignments');
          
          // Try to parse just the core data without word assignments
          try {
            // Extract just the core sections without word assignments
            const coreJsonMatch = jsonString.match(/\{[^}]*"transcription"\s*:\s*"[^"]*"[^}]*"marketingSegments"\s*:\s*\{[^}]*\}[^}]*\}/s);
            if (coreJsonMatch) {
              const coreJson = coreJsonMatch[0];
              const coreParsed = JSON.parse(coreJson);
              
              if (coreParsed.transcription && coreParsed.marketingSegments) {
                console.log('[TranscriptionService] Successfully parsed core JSON without word assignments');
                return {
                  transcription: coreParsed.transcription,
                  marketingSegments: coreParsed.marketingSegments
                };
              }
            }
          } catch (coreParseError) {
            console.error('[TranscriptionService] Core JSON parsing also failed:', coreParseError);
          }
        }
      }
      
      // If JSON parsing fails, try to extract manually
      console.warn('[TranscriptionService] Failed to parse JSON response, attempting manual extraction');
      
      // Look for transcription section with various patterns
      const transcriptionPatterns = [
        /(?:"transcription"\s*:\s*"(.*?)"\s*[,}])/is,
        /(?:transcription['"]\s*:\s*['"](.*?)['"]\s*[,}])/is,
        /(?:Transcription:\s*(.*?)(?:\n\n|\n(?=[A-Z])))/is
      ];
      
      let transcription = '';
      for (const pattern of transcriptionPatterns) {
        const match = responseText.match(pattern);
        if (match) {
          transcription = match[1].trim();
          console.log('[TranscriptionService] Extracted transcription using pattern');
          break;
        }
      }
      
      // If no transcription found, try to extract just the text content without word assignments
      if (!transcription) {
        // Try to find content between "transcription" and "marketingSegments" or "wordAssignments"
        const transcriptionSectionMatch = responseText.match(/"transcription"\s*:\s*"(.*?)"\s*,\s*"(?:marketingSegments|wordAssignments)/is);
        if (transcriptionSectionMatch) {
          transcription = transcriptionSectionMatch[1].trim();
          console.log('[TranscriptionService] Extracted transcription from section');
        } else {
          // Last resort: try to extract from marketing segments concatenation
          console.warn('[TranscriptionService] Could not extract transcription, will attempt to reconstruct from segments');
          transcription = this.reconstructTranscriptionFromSegments(responseText);
        }
      }
      
      // Try to extract marketing segments manually
      const hookMatch = responseText.match(/(?:Hook['"]\s*:\s*['"](.*?)['"]\s*[,}])|(?:Hook:\s*(.*?)(?:\n|$))/is);
      const bridgeMatch = responseText.match(/(?:Bridge['"]\s*:\s*['"](.*?)['"]\s*[,}])|(?:Bridge:\s*(.*?)(?:\n|$))/is);
      const nuggetMatch = responseText.match(/(?:Golden Nugget['"]\s*:\s*['"](.*?)['"]\s*[,}])|(?:Golden Nugget:\s*(.*?)(?:\n|$))/is);
      const wtaMatch = responseText.match(/(?:WTA['"]\s*:\s*['"](.*?)['"]\s*[,}])|(?:WTA:\s*(.*?)(?:\n|$))/is);
      
      const marketingSegments: MarketingSegments = {
        Hook: hookMatch ? (hookMatch[1] || hookMatch[2] || '').trim() : 'Not Present',
        Bridge: bridgeMatch ? (bridgeMatch[1] || bridgeMatch[2] || '').trim() : 'Not Present',
        "Golden Nugget": nuggetMatch ? (nuggetMatch[1] || nuggetMatch[2] || '').trim() : 'Not Present',
        WTA: wtaMatch ? (wtaMatch[1] || wtaMatch[2] || '').trim() : 'Not Present'
      };
      
      console.log('[TranscriptionService] Manual extraction completed');
      
      return {
        transcription,
        marketingSegments
      };
      
    } catch (error) {
      console.error('[TranscriptionService] Error parsing marketing response:', error);
      console.error('[TranscriptionService] Raw response that failed:', responseText.substring(0, 500) + '...');
      
      // Try one last attempt to extract just the transcription text
      let fallbackTranscription = 'Parsing failed - unable to extract transcription';
      const lastResortMatch = responseText.match(/"transcription"\s*:\s*"([^"]*?)"/i);
      if (lastResortMatch) {
        fallbackTranscription = lastResortMatch[1];
        console.log('[TranscriptionService] Extracted fallback transcription');
      }
      
      return {
        transcription: fallbackTranscription,
        marketingSegments: {
          Hook: 'Parsing Error',
          Bridge: 'Parsing Error',
          "Golden Nugget": 'Parsing Error',
          WTA: 'Parsing Error'
        }
      };
    }
  }

  /**
   * Reconstruct transcription from marketing segments when direct extraction fails
   */
  private reconstructTranscriptionFromSegments(responseText: string): string {
    try {
      // Extract marketing segments
      const hookMatch = responseText.match(/"Hook"\s*:\s*"([^"]*?)"/i);
      const bridgeMatch = responseText.match(/"Bridge"\s*:\s*"([^"]*?)"/i);
      const nuggetMatch = responseText.match(/"Golden Nugget"\s*:\s*"([^"]*?)"/i);
      const wtaMatch = responseText.match(/"WTA"\s*:\s*"([^"]*?)"/i);
      
      const segments = [
        hookMatch ? hookMatch[1] : '',
        bridgeMatch ? bridgeMatch[1] : '',
        nuggetMatch ? nuggetMatch[1] : '',
        wtaMatch ? wtaMatch[1] : ''
      ].filter(segment => segment.trim().length > 0);
      
      if (segments.length > 0) {
        const reconstructed = segments.join(' ').trim();
        console.log('[TranscriptionService] Reconstructed transcription from segments');
        return reconstructed;
      }
    } catch (error) {
      console.error('[TranscriptionService] Failed to reconstruct from segments:', error);
    }
    
    return 'Transcription extraction failed - unable to parse response';
  }

  /**
   * Validate that word assignments cover the entire transcript
   */
  private validateWordAssignments(
    transcription: string,
    marketingSegments: MarketingSegments,
    wordAssignments: WordAssignment[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Check if word assignments exist
      if (!wordAssignments || wordAssignments.length === 0) {
        errors.push('No word assignments provided');
        return { valid: false, errors };
      }

      // Reconstruct transcript from word assignments
      const sortedAssignments = wordAssignments.sort((a, b) => a.position - b.position);
      const reconstructedTranscript = sortedAssignments.map(w => w.word).join(' ');
      
      // Normalize both transcripts for comparison (remove extra whitespace, normalize punctuation)
      const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();
      const originalNormalized = normalizeText(transcription);
      const reconstructedNormalized = normalizeText(reconstructedTranscript);
      
      if (originalNormalized !== reconstructedNormalized) {
        errors.push(`Word assignments don't match original transcript. Original: "${originalNormalized.substring(0, 100)}..." Reconstructed: "${reconstructedNormalized.substring(0, 100)}..."`);
      }

      // Check that marketing segments concatenation matches transcript
      const segmentsConcatenated = [
        marketingSegments.Hook,
        marketingSegments.Bridge,
        marketingSegments["Golden Nugget"],
        marketingSegments.WTA
      ].join(' ');
      
      const segmentsNormalized = normalizeText(segmentsConcatenated);
      
      if (originalNormalized !== segmentsNormalized) {
        errors.push(`Marketing segments concatenation doesn't match original transcript`);
      }

      // Check for duplicate positions
      const positions = wordAssignments.map(w => w.position);
      const uniquePositions = new Set(positions);
      if (positions.length !== uniquePositions.size) {
        errors.push('Duplicate word positions found');
      }

      // Check for missing positions (should be consecutive from 1 to N)
      const expectedPositions = Array.from({ length: wordAssignments.length }, (_, i) => i + 1);
      const missingPositions = expectedPositions.filter(pos => !positions.includes(pos));
      if (missingPositions.length > 0) {
        errors.push(`Missing word positions: ${missingPositions.join(', ')}`);
      }

      // Validate category distribution
      const categoryStats = {
        Hook: wordAssignments.filter(w => w.category === 'Hook').length,
        Bridge: wordAssignments.filter(w => w.category === 'Bridge').length,
        'Golden Nugget': wordAssignments.filter(w => w.category === 'Golden Nugget').length,
        WTA: wordAssignments.filter(w => w.category === 'WTA').length
      };

      console.log('[TranscriptionService] Word assignment distribution:', categoryStats);

      return { valid: errors.length === 0, errors };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors };
    }
  }

  /**
   * Create a failed job result
   */
  private createFailedJobResult(
    videos: VideoMetadata[],
    errors: Array<{ videoId: string; error: string }>,
    processingTime: number
  ): TranscriptionJobResult {
    const results: TranscriptionResult[] = videos.map(video => 
      this.createTranscriptionResult(video, '', false, 'Job failed before processing')
    );
    
    return {
      success: false,
      results,
      totalProcessed: videos.length,
      totalFailed: videos.length,
      processingTime,
      errors
    };
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    geminiApiKey: boolean;
    timestamp: string;
  }> {
    try {
      const hasApiKey = !!process.env.GEMINI_API_KEY;
      
      return {
        status: hasApiKey ? 'healthy' : 'unhealthy',
        geminiApiKey: hasApiKey,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        geminiApiKey: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate templates from marketing segments
   */
  async generateTemplatesFromResult(result: TranscriptionResult): Promise<{
    success: boolean;
    template?: ScriptTemplate;
    error?: string;
    processingTime: number;
  }> {
    if (!result.success || !result.marketingSegments) {
      return {
        success: false,
        error: 'No marketing segments available for template generation',
        processingTime: 0
      };
    }

    console.log(`[TranscriptionService] Generating templates for video ${result.videoId}`);
    return await this.templateGenerator.generateTemplatesFromSegments(result.marketingSegments);
  }

  /**
   * Generate synthetic script using templates
   */
  async generateSyntheticScript(topic: string, template: ScriptTemplate): Promise<{
    success: boolean;
    script?: MarketingSegments;
    error?: string;
    processingTime: number;
  }> {
    console.log(`[TranscriptionService] Generating synthetic script for topic: ${topic}`);
    return await this.templateGenerator.generateSyntheticScript(topic, template);
  }
} 