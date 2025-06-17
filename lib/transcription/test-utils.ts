import { VideoMetadata, TranscriptionRequest, TranscriptionOptions } from './types';

/**
 * Sample video metadata for testing
 */
export const sampleVideos: VideoMetadata[] = [
  {
    id: 'test-video-1',
    url: 'https://example.com/video1.mp4',
    platform: 'tiktok',
    description: 'Test TikTok video'
  },
  {
    id: 'test-video-2', 
    url: 'https://example.com/video2.mp4',
    platform: 'instagram',
    description: 'Test Instagram video'
  }
];

/**
 * Sample transcription request for testing
 */
export const sampleTranscriptionRequest: TranscriptionRequest = {
  videos: sampleVideos,
  options: {
    extractMarketingSegments: true,
    includeVisualDescriptions: false,
    model: 'gemini-2.0-flash'
  }
};

/**
 * Sample transcription options for marketing analysis
 */
export const marketingAnalysisOptions: TranscriptionOptions = {
  extractMarketingSegments: true,
  includeVisualDescriptions: false,
  model: 'gemini-2.0-flash'
};

/**
 * Sample transcription options for basic transcription
 */
export const basicTranscriptionOptions: TranscriptionOptions = {
  extractMarketingSegments: false,
  includeVisualDescriptions: false,
  model: 'gemini-2.0-flash'
};

/**
 * Validate video metadata
 */
export function validateVideoMetadata(video: VideoMetadata): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!video.id) {
    errors.push('Video ID is required');
  }
  
  if (!video.url) {
    errors.push('Video URL is required');
  } else {
    try {
      new URL(video.url);
    } catch {
      errors.push('Invalid video URL format');
    }
  }
  
  if (!video.platform || !['tiktok', 'instagram'].includes(video.platform)) {
    errors.push('Platform must be "tiktok" or "instagram"');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create test video metadata
 */
export function createTestVideo(
  id: string,
  platform: 'tiktok' | 'instagram',
  url?: string
): VideoMetadata {
  return {
    id,
    url: url || `https://example.com/${platform}/${id}.mp4`,
    platform,
    description: `Test ${platform} video: ${id}`
  };
}

/**
 * Mock successful transcription response
 */
export const mockSuccessfulTranscriptionResponse = {
  text: `{
    "transcription": "You can't get off that fucking phone and that's the reason why you can't create shit. Let's talk about it. People don't even know how to give themselves five seconds of silence. Creativity won't show up when your brain is overstimulated. It's only going to show up when your brain is still. So yeah, this is your sign to try this shit out too.",
    "marketingSegments": {
      "Hook": "You can't get off that fucking phone and that's the reason why you can't create shit.",
      "Bridge": "Let's talk about it. People don't even know how to give themselves five seconds of silence.",
      "Golden Nugget": "Creativity won't show up when your brain is overstimulated. It's only going to show up when your brain is still.",
      "WTA": "So yeah, this is your sign to try this shit out too."
    },
    "wordAssignments": [
      {"word": "You", "category": "Hook", "position": 1},
      {"word": "can't", "category": "Hook", "position": 2},
      {"word": "get", "category": "Hook", "position": 3},
      {"word": "off", "category": "Hook", "position": 4},
      {"word": "that", "category": "Hook", "position": 5},
      {"word": "fucking", "category": "Hook", "position": 6},
      {"word": "phone", "category": "Hook", "position": 7},
      {"word": "and", "category": "Hook", "position": 8},
      {"word": "that's", "category": "Hook", "position": 9},
      {"word": "the", "category": "Hook", "position": 10},
      {"word": "reason", "category": "Hook", "position": 11},
      {"word": "why", "category": "Hook", "position": 12},
      {"word": "you", "category": "Hook", "position": 13},
      {"word": "can't", "category": "Hook", "position": 14},
      {"word": "create", "category": "Hook", "position": 15},
      {"word": "shit.", "category": "Hook", "position": 16},
      {"word": "Let's", "category": "Bridge", "position": 17},
      {"word": "talk", "category": "Bridge", "position": 18},
      {"word": "about", "category": "Bridge", "position": 19},
      {"word": "it.", "category": "Bridge", "position": 20},
      {"word": "People", "category": "Bridge", "position": 21},
      {"word": "don't", "category": "Bridge", "position": 22},
      {"word": "even", "category": "Bridge", "position": 23},
      {"word": "know", "category": "Bridge", "position": 24},
      {"word": "how", "category": "Bridge", "position": 25},
      {"word": "to", "category": "Bridge", "position": 26},
      {"word": "give", "category": "Bridge", "position": 27},
      {"word": "themselves", "category": "Bridge", "position": 28},
      {"word": "five", "category": "Bridge", "position": 29},
      {"word": "seconds", "category": "Bridge", "position": 30},
      {"word": "of", "category": "Bridge", "position": 31},
      {"word": "silence.", "category": "Bridge", "position": 32},
      {"word": "Creativity", "category": "Golden Nugget", "position": 33},
      {"word": "won't", "category": "Golden Nugget", "position": 34},
      {"word": "show", "category": "Golden Nugget", "position": 35},
      {"word": "up", "category": "Golden Nugget", "position": 36},
      {"word": "when", "category": "Golden Nugget", "position": 37},
      {"word": "your", "category": "Golden Nugget", "position": 38},
      {"word": "brain", "category": "Golden Nugget", "position": 39},
      {"word": "is", "category": "Golden Nugget", "position": 40},
      {"word": "overstimulated.", "category": "Golden Nugget", "position": 41},
      {"word": "It's", "category": "Golden Nugget", "position": 42},
      {"word": "only", "category": "Golden Nugget", "position": 43},
      {"word": "going", "category": "Golden Nugget", "position": 44},
      {"word": "to", "category": "Golden Nugget", "position": 45},
      {"word": "show", "category": "Golden Nugget", "position": 46},
      {"word": "up", "category": "Golden Nugget", "position": 47},
      {"word": "when", "category": "Golden Nugget", "position": 48},
      {"word": "your", "category": "Golden Nugget", "position": 49},
      {"word": "brain", "category": "Golden Nugget", "position": 50},
      {"word": "is", "category": "Golden Nugget", "position": 51},
      {"word": "still.", "category": "Golden Nugget", "position": 52},
      {"word": "So", "category": "WTA", "position": 53},
      {"word": "yeah,", "category": "WTA", "position": 54},
      {"word": "this", "category": "WTA", "position": 55},
      {"word": "is", "category": "WTA", "position": 56},
      {"word": "your", "category": "WTA", "position": 57},
      {"word": "sign", "category": "WTA", "position": 58},
      {"word": "to", "category": "WTA", "position": 59},
      {"word": "try", "category": "WTA", "position": 60},
      {"word": "this", "category": "WTA", "position": 61},
      {"word": "shit", "category": "WTA", "position": 62},
      {"word": "out", "category": "WTA", "position": 63},
      {"word": "too.", "category": "WTA", "position": 64}
    ]
  }`,
  usage: {
    promptTokens: 150,
    completionTokens: 200,
    totalTokens: 350
  }
};

/**
 * Mock failed transcription response
 */
export const mockFailedTranscriptionResponse = {
  error: 'Failed to transcribe video: Network timeout'
};

/**
 * Test environment validation
 */
export function validateTestEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!process.env.GEMINI_API_KEY) {
    errors.push('GEMINI_API_KEY environment variable is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a minimal test request with one video
 */
export function createMinimalTestRequest(videoUrl: string, platform: 'tiktok' | 'instagram' = 'tiktok'): TranscriptionRequest {
  return {
    videos: [{
      id: `test-${Date.now()}`,
      url: videoUrl,
      platform
    }],
    options: {
      extractMarketingSegments: true
    }
  };
}

/**
 * Validate environment setup for transcription
 */
export function validateEnvironment(): {
  valid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check Gemini API key
  if (!process.env.GEMINI_API_KEY) {
    issues.push('GEMINI_API_KEY environment variable is not set');
    recommendations.push('Get a Gemini API key from https://ai.google.dev/ and add it to your .env.local file');
  } else if (process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    issues.push('GEMINI_API_KEY is set to placeholder value');
    recommendations.push('Replace the placeholder with your actual Gemini API key');
  } else if (!process.env.GEMINI_API_KEY.startsWith('AIza')) {
    issues.push('GEMINI_API_KEY does not appear to be a valid Gemini API key');
    recommendations.push('Ensure you are using a valid Gemini API key that starts with "AIza"');
  }

  // Check Google Drive setup
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    issues.push('GOOGLE_SERVICE_ACCOUNT_EMAIL is not set');
    recommendations.push('Google Drive integration requires a service account email');
  }

  if (!process.env.GOOGLE_PRIVATE_KEY) {
    issues.push('GOOGLE_PRIVATE_KEY is not set');
    recommendations.push('Google Drive integration requires a service account private key');
  }

  if (!process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID) {
    issues.push('GOOGLE_DRIVE_PARENT_FOLDER_ID is not set');
    recommendations.push('Set a parent folder ID for organizing transcription results');
  }

  return {
    valid: issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * Log environment status for debugging
 */
export function logEnvironmentStatus(): void {
  const status = validateEnvironment();
  
  console.log('\n=== Transcription Environment Status ===');
  console.log(`Status: ${status.valid ? '✅ Ready' : '❌ Issues Found'}`);
  
  if (status.issues.length > 0) {
    console.log('\n🚨 Issues:');
    status.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }
  
  if (status.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    status.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }
  
  console.log('\n=== Environment Variables ===');
  console.log(`GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`GOOGLE_SERVICE_ACCOUNT_EMAIL: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✅ Set' : '❌ Missing'}`);
  console.log(`GOOGLE_PRIVATE_KEY: ${process.env.GOOGLE_PRIVATE_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`GOOGLE_DRIVE_PARENT_FOLDER_ID: ${process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID ? '✅ Set' : '❌ Missing'}`);
  console.log('=====================================\n');
}

/**
 * Format transcription results for console output
 */
export function formatTranscriptionResults(results: any): string {
  let output = '\n=== Marketing Analysis Results ===\n';
  
  output += `Total Videos: ${results.summary.totalVideos}\n`;
  output += `Successful: ${results.summary.successful}\n`;
  output += `Failed: ${results.summary.failed}\n`;
  output += `Processing Time: ${results.summary.processingTime}ms\n\n`;
  
  if (results.transcriptionResults) {
    results.transcriptionResults.forEach((result: any, index: number) => {
      output += `--- Video ${index + 1}: ${result.videoId} ---\n`;
      output += `Platform: ${result.platform}\n`;
      output += `Status: ${result.success ? '✅ Success' : '❌ Failed'}\n`;
      
      if (result.success) {
        output += `Transcription: ${result.transcription.substring(0, 200)}${result.transcription.length > 200 ? '...' : ''}\n`;
        if (result.marketingSegments) {
          output += `Marketing Segments:\n`;
          output += `  🎣 Hook: ${result.marketingSegments.Hook}\n`;
          output += `  🌉 Bridge: ${result.marketingSegments.Bridge}\n`;
          output += `  💎 Golden Nugget: ${result.marketingSegments["Golden Nugget"]}\n`;
          output += `  🎯 WTA: ${result.marketingSegments.WTA}\n`;
        }
      } else {
        output += `Error: ${result.error}\n`;
      }
      
      output += `Processing Time: ${result.processingTime}ms\n\n`;
    });
  }
  
  if (results.googleDrive) {
    output += `Google Drive: ✅ Saved to ${results.googleDrive.folderName}\n`;
    output += `Files: ${results.googleDrive.files.length} uploaded\n`;
  }
  
  output += '==============================\n';
  
  return output;
} 