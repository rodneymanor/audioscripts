import { DownloadedVideo, GeminiResponse, TranscriptionOptions } from './types';

export class GeminiTranscriptionError extends Error {
  constructor(
    message: string,
    public videoId: string,
    public statusCode?: number,
    public cause?: Error
  ) {
    super(message);
    this.name = 'GeminiTranscriptionError';
  }
}

export class GeminiClient {
  private static readonly API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
  private static readonly DEFAULT_MODEL = 'gemini-2.0-flash';
  private static readonly REQUEST_TIMEOUT = 60000; // 60 seconds
  private static readonly RATE_LIMIT_DELAY = 500; // Reduced from 1000ms to 500ms
  private static readonly FAST_MODE_DELAY = 200; // Even faster for simple transcription

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('Gemini API key is required. Set GEMINI_API_KEY environment variable.');
    }
  }

  /**
   * Transcribe a single video using Gemini API
   */
  async transcribeVideo(
    video: DownloadedVideo, 
    options: TranscriptionOptions = {}
  ): Promise<GeminiResponse> {
    const startTime = Date.now();
    const videoId = video.metadata.id;
    
    try {
      console.log(`[GeminiClient] Starting transcription for video: ${videoId} (${this.getProcessingMode(options)})`);
      
      const model = options.model || GeminiClient.DEFAULT_MODEL;
      const prompt = this.buildTranscriptionPrompt(options);
      const base64Data = video.buffer.toString('base64');

      const requestBody = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: video.mimeType,
                  data: base64Data
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: this.getOptimizedGenerationConfig(options)
      };

      const response = await this.makeRequest(model, requestBody, videoId);
      const processingTime = Date.now() - startTime;
      
      console.log(`[GeminiClient] Successfully transcribed ${videoId} in ${processingTime}ms (${this.getProcessingMode(options)})`);
      
      return {
        text: response.text,
        usage: response.usage
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[GeminiClient] Failed to transcribe ${videoId} after ${processingTime}ms:`, error);
      
      throw new GeminiTranscriptionError(
        `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        videoId,
        error instanceof Error && 'status' in error ? (error as any).status : undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Transcribe multiple videos with optimized rate limiting
   */
  async transcribeVideos(
    videos: DownloadedVideo[],
    options: TranscriptionOptions = {}
  ): Promise<{
    successful: Array<{ video: DownloadedVideo; response: GeminiResponse }>;
    failed: Array<{ video: DownloadedVideo; error: GeminiTranscriptionError }>;
  }> {
    console.log(`[GeminiClient] Starting batch transcription of ${videos.length} videos (${this.getProcessingMode(options)})`);
    
    // Use parallel processing for fast mode with small batches
    if (options.fastMode && videos.length <= 5) {
      return this.transcribeVideosParallel(videos, options);
    }
    
    const successful: Array<{ video: DownloadedVideo; response: GeminiResponse }> = [];
    const failed: Array<{ video: DownloadedVideo; error: GeminiTranscriptionError }> = [];

    // Use optimized delay based on processing mode
    const delay = options.extractMarketingSegments 
      ? GeminiClient.RATE_LIMIT_DELAY 
      : GeminiClient.FAST_MODE_DELAY;

    // Process videos sequentially with optimized rate limiting
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      
      try {
        const response = await this.transcribeVideo(video, options);
        successful.push({ video, response });
        
        // Add optimized delay between requests (except for the last one)
        if (i < videos.length - 1) {
          await this.delay(delay);
        }
        
      } catch (error) {
        const transcriptionError = error instanceof GeminiTranscriptionError 
          ? error 
          : new GeminiTranscriptionError(
              `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              video.metadata.id,
              undefined,
              error instanceof Error ? error : undefined
            );
        
        failed.push({ video, error: transcriptionError });
      }
    }

    console.log(`[GeminiClient] Batch transcription complete: ${successful.length} successful, ${failed.length} failed`);
    
    return { successful, failed };
  }

  /**
   * Parallel transcription for small batches in fast mode
   */
  private async transcribeVideosParallel(
    videos: DownloadedVideo[],
    options: TranscriptionOptions
  ): Promise<{
    successful: Array<{ video: DownloadedVideo; response: GeminiResponse }>;
    failed: Array<{ video: DownloadedVideo; error: GeminiTranscriptionError }>;
  }> {
    console.log(`[GeminiClient] Using parallel processing for ${videos.length} videos`);
    
    const promises = videos.map(async (video) => {
      try {
        const response = await this.transcribeVideo(video, options);
        return { success: true, video, response };
      } catch (error) {
        const transcriptionError = error instanceof GeminiTranscriptionError 
          ? error 
          : new GeminiTranscriptionError(
              `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              video.metadata.id,
              undefined,
              error instanceof Error ? error : undefined
            );
        return { success: false, video, error: transcriptionError };
      }
    });

    const results = await Promise.all(promises);
    
    const successful = results
      .filter(r => r.success && r.response)
      .map(r => ({ video: r.video, response: r.response! }));
    
    const failed = results
      .filter(r => !r.success && r.error)
      .map(r => ({ video: r.video, error: r.error! }));

    console.log(`[GeminiClient] Parallel transcription complete: ${successful.length} successful, ${failed.length} failed`);
    
    return { successful, failed };
  }

  /**
   * Get optimized generation config based on processing mode
   */
  private getOptimizedGenerationConfig(options: TranscriptionOptions) {
    if (options.extractMarketingSegments) {
      // Complex analysis mode - need more tokens and careful generation
      return {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192
      };
    } else {
      // Fast transcription mode - optimize for speed
      return {
        temperature: 0.0, // More deterministic for faster processing
        topK: 20, // Reduced for faster token selection
        topP: 0.8, // More focused for speed
        maxOutputTokens: 4096 // Reduced for faster generation
      };
    }
  }

  /**
   * Get processing mode description for logging
   */
  private getProcessingMode(options: TranscriptionOptions): string {
    return options.extractMarketingSegments ? 'Marketing Analysis' : 'Fast Transcription';
  }

  /**
   * Build transcription prompt based on options
   */
  private buildTranscriptionPrompt(options: TranscriptionOptions): string {
    if (options.extractMarketingSegments) {
      // Marketing analysis prompt - combines transcription and word-level segment assignment
      let prompt = `You are an expert Script Analyst AI. Your task is to:

1. First, transcribe the audio from this video accurately
2. Then analyze the transcript and assign EVERY SINGLE WORD to one of the four marketing categories

CRITICAL REQUIREMENTS:
- Every word in the transcript must be assigned to exactly one category
- No word can be left unassigned
- No word can be assigned to multiple categories
- The sum of all category text must equal the complete transcript
- Maintain the original word order and spacing

CRITICAL OUTPUT REQUIREMENT: 
Your response must start IMMEDIATELY with the opening brace { and contain NOTHING else except the JSON object. 

DO NOT include:
- Any introductory text like "Okay, I'm ready to analyze..."
- Any explanatory comments
- Markdown formatting or code blocks
- Any text before or after the JSON

Your first character must be { and your last character must be }

Expected JSON format:
{
  "transcription": "The complete, accurate transcription of the video audio",
  "marketingSegments": {
    "Hook": "All words assigned to Hook category in original order",
    "Bridge": "All words assigned to Bridge category in original order", 
    "Golden Nugget": "All words assigned to Golden Nugget category in original order",
    "WTA": "All words assigned to WTA category in original order"
  },
  "wordAssignments": [
    {"word": "first_word", "category": "Hook", "position": 1},
    {"word": "second_word", "category": "Hook", "position": 2},
    {"word": "third_word", "category": "Bridge", "position": 3}
  ]
}

PRECISE CATEGORY DEFINITIONS:

Hook: ONLY the initial attention-grabbing statement that presents the core problem, controversial opinion, or bold claim. This should be ONE complete sentence or thought that immediately hooks the viewer. Stop at the first natural pause or when transitional language begins.

Examples of Hook boundaries:
- "You can't get off that fucking phone and that's the reason why you can't create shit." (STOP HERE)
- "Batch recording content got to be one of the most overrated things in content creation." (STOP HERE)

DO NOT include in Hook:
- Transitional phrases like "Let's talk about it"
- Explanatory setup like "Now look, before y'all start typing..."
- Multiple sentences that elaborate on the initial statement
- Any "bridge" language that connects to the main content

Bridge: Words that build connection, establish credibility, provide context, or transition from the hook to the main content. This includes:
- Transitional phrases ("Let's talk about it", "Now look")
- Credibility builders and disclaimers
- Context setting and audience acknowledgment
- Setup for the main teaching point

Golden Nugget: Words containing the main value, insights, tips, or core educational content. The actual teaching or valuable information being shared.

WTA (Why To Act): Words that create urgency, provide calls-to-action, or motivate immediate response. Usually at the end encouraging follow, subscribe, or take action.

ASSIGNMENT STRATEGY:
1. Transcribe the complete audio first
2. Identify the Hook: Find the FIRST bold statement that grabs attention - usually one sentence
3. Identify transitions and setup language for Bridge
4. Identify the main teaching content for Golden Nugget  
5. Identify calls-to-action for WTA
6. Assign each word to the most appropriate category
7. Verify that concatenating all category text recreates the original transcript

VALIDATION CHECK:
- Hook + Bridge + Golden Nugget + WTA = Complete Transcript (word for word)
- Hook should be SHORT and PUNCHY (typically 1 sentence)
- Bridge should handle transitions and setup
- Golden Nugget should contain the main value
- WTA should drive action

FINAL REMINDER: Your response must be PURE JSON starting with { and ending with }. No other text whatsoever.`;

      if (options.includeVisualDescriptions) {
        prompt += ' Also include relevant visual descriptions that support the marketing analysis.';
      }
      
      if (options.language) {
        prompt += ` The content is primarily in ${options.language}.`;
      }
      
      return prompt;
    } else {
      // Standard transcription prompt - optimized for speed
      let prompt = 'Transcribe the audio from this video accurately. Return only the transcription text without any additional formatting or explanations.';
      
      if (options.includeVisualDescriptions) {
        prompt += ' Also provide brief visual descriptions of what is happening in the video.';
      }
      
      if (options.language) {
        prompt += ` The content is primarily in ${options.language}.`;
      }
      
      return prompt;
    }
  }

  /**
   * Make HTTP request to Gemini API
   */
  private async makeRequest(model: string, body: any, videoId: string): Promise<any> {
    const url = `${GeminiClient.API_BASE_URL}/${model}:generateContent?key=${this.apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GeminiClient.REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          // If we can't parse the error, use the raw text
          if (errorText) {
            errorMessage += ` - ${errorText}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response format from Gemini API');
      }

      const text = data.candidates[0].content.parts
        ?.map((part: any) => part.text)
        .join('') || '';

      if (!text.trim()) {
        throw new Error('Empty transcription response from Gemini API');
      }

      return {
        text: text.trim(),
        usage: data.usageMetadata ? {
          promptTokens: data.usageMetadata.promptTokenCount || 0,
          completionTokens: data.usageMetadata.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata.totalTokenCount || 0
        } : undefined
      };

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate API key format
   */
  static validateApiKey(apiKey: string): boolean {
    return !!(apiKey && apiKey.length > 10 && apiKey.startsWith('AIza'));
  }
}