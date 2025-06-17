# Video Marketing Analysis Module

A modular, well-organized system for downloading videos from social media platforms and analyzing them for marketing segments using Google's Gemini API.

## Architecture

This module follows separation of concerns with distinct responsibilities:

```
lib/transcription/
├── types.ts                    # TypeScript interfaces
├── video-downloader.ts         # Video download logic
├── gemini-client.ts           # Gemini API integration
├── transcription-service.ts   # Main orchestration
├── test-utils.ts             # Testing utilities
├── index.ts                  # Clean exports
└── README.md                 # This file
```

## Features

- ✅ **Download videos** from URLs (up to 5MB)
- ✅ **Base64 encoding** for Gemini API compatibility
- ✅ **Batch processing** with error handling
- ✅ **Rate limiting** to respect API limits
- ✅ **Marketing segment extraction** (Hook, Bridge, Golden Nugget, WTA)
- ✅ **Google Drive integration** for result storage
- ✅ **Comprehensive logging** for debugging
- ✅ **Type safety** with TypeScript
- ✅ **Modular design** for easy maintenance

## Marketing Segments Analysis

The module specializes in extracting four key marketing components from video content:

- **🎣 Hook**: The opening that grabs the viewer's attention
- **🌉 Bridge**: The transition that builds connection and keeps viewers engaged  
- **💎 Golden Nugget**: The main valuable insight, tip, or core content
- **🎯 WTA (Why To Act)**: The call-to-action or compelling reason for the viewer to take action

## Quick Start

### 1. Environment Setup

Add to your `.env.local`:

```bash
# Gemini API Configuration
GEMINI_API_KEY="AIza..."

# Google Drive Credentials (existing)
GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
GOOGLE_PRIVATE_KEY="..."
GOOGLE_DRIVE_PARENT_FOLDER_ID="..."
```

### 2. Basic Usage

```typescript
import { TranscriptionService } from '@/lib/transcription';

const service = new TranscriptionService();

const request = {
  videos: [
    {
      id: 'video-1',
      url: 'https://example.com/video.mp4',
      platform: 'tiktok' as const
    }
  ],
  options: {
    extractMarketingSegments: true,
    includeVisualDescriptions: false,
    model: 'gemini-2.0-flash' as const
  }
};

const result = await service.processTranscriptionRequest(request);
console.log(result);
```

### 3. API Endpoint

The module includes a ready-to-use API route at `/api/transcribe-videos`:

```bash
# Health check
GET /api/transcribe-videos

# Analyze videos for marketing segments
POST /api/transcribe-videos
Content-Type: application/json

{
  "videos": [
    {
      "id": "video-1",
      "url": "https://example.com/video.mp4", 
      "platform": "tiktok"
    }
  ],
  "options": {
    "extractMarketingSegments": true,
    "model": "gemini-2.0-flash"
  }
}
```

## Module Details

### VideoDownloader

Handles video downloading with:
- Size validation (max 5MB)
- Timeout protection (30s)
- MIME type validation
- Error handling with detailed messages

```typescript
import { VideoDownloader } from '@/lib/transcription';

const video = await VideoDownloader.downloadVideo({
  id: 'test',
  url: 'https://example.com/video.mp4',
  platform: 'tiktok'
});

const base64 = VideoDownloader.videoToBase64(video);
```

### GeminiClient

Manages Gemini API interactions:
- Base64 video processing
- Rate limiting (1s between requests)
- Marketing analysis prompts
- Token usage tracking

```typescript
import { GeminiClient } from '@/lib/transcription';

const client = new GeminiClient();
const response = await client.transcribeVideo(downloadedVideo, {
  extractMarketingSegments: true,
  model: 'gemini-2.0-flash'
});
```

### TranscriptionService

Main orchestration service:
- Coordinates download → analysis → storage
- Batch processing with error isolation
- Result aggregation and formatting
- Health status monitoring

```typescript
import { TranscriptionService } from '@/lib/transcription';

const service = new TranscriptionService();
const health = await service.getHealthStatus();
const result = await service.transcribeSingleVideo(metadata);
```

## Marketing Analysis Response

When `extractMarketingSegments: true` is enabled, the response includes:

```json
{
  "success": true,
  "data": {
    "transcriptionResults": [
      {
        "videoId": "video-1",
        "platform": "tiktok",
        "transcription": "Full video transcription...",
        "marketingSegments": {
          "Hook": "Are you struggling with your marketing?",
          "Bridge": "I used to have the same problem until I discovered this simple technique.",
          "Golden Nugget": "The key is to focus on your audience's pain points and provide immediate value.",
          "WTA": "Try this strategy today and see the difference it makes in your business!"
        },
        "success": true,
        "processingTime": 3500
      }
    ],
    "summary": {
      "totalVideos": 1,
      "successful": 1,
      "failed": 0,
      "processingTime": 4200
    }
  }
}
```

## Error Handling

The module includes comprehensive error handling:

### Custom Error Types

- `VideoDownloadError`: Download failures with context
- `GeminiTranscriptionError`: API failures with details

### Error Isolation

- Failed downloads don't stop analysis of other videos
- Failed analyses don't stop Google Drive uploads
- Detailed error reporting for debugging

### Example Error Response

```json
{
  "success": false,
  "data": {
    "summary": {
      "totalVideos": 3,
      "successful": 1,
      "failed": 2
    },
    "errors": [
      {
        "videoId": "video-1",
        "error": "File too large: 6MB (max: 5MB)"
      },
      {
        "videoId": "video-2", 
        "error": "Marketing analysis failed: Invalid API key"
      }
    ]
  }
}
```

## Testing & Debugging

### Environment Validation

```typescript
import { validateEnvironment, logEnvironmentStatus } from '@/lib/transcription/test-utils';

// Check setup
const status = validateEnvironment();
if (!status.valid) {
  console.log('Issues:', status.issues);
  console.log('Recommendations:', status.recommendations);
}

// Detailed logging
logEnvironmentStatus();
```

### Test Utilities

```typescript
import { 
  createSampleTranscriptionRequest,
  createMinimalTestRequest,
  formatTranscriptionResults 
} from '@/lib/transcription/test-utils';

// Create test data
const testRequest = createMinimalTestRequest('https://example.com/video.mp4');

// Format results for console
const formatted = formatTranscriptionResults(result);
console.log(formatted);
```

## Configuration Options

### Transcription Options

```typescript
interface TranscriptionOptions {
  includeTimestamps?: boolean;        // Add [MM:SS] timestamps
  includeVisualDescriptions?: boolean; // Describe visual content
  language?: string;                  // Expected language
  model?: 'gemini-2.0-flash' |       // Model selection
          'gemini-2.5-flash-preview' |
          'gemini-2.5-pro-preview';
}
```

### Supported Models

- `gemini-2.0-flash`: Fast, cost-effective (recommended)
- `gemini-2.5-flash-preview`: Enhanced capabilities
- `gemini-2.5-pro-preview`: Maximum quality

### File Limits

- **Max file size**: 5MB per video
- **Max request size**: 20MB total
- **Supported formats**: MP4, MOV, AVI, WebM, etc.
- **Timeout**: 30s download, 60s transcription

## Integration with Existing System

This module integrates seamlessly with your existing:

### URL Extraction API

```typescript
// In your existing process-creator route
const extractedVideos = /* your existing URL extraction */;

// Convert to transcription format
const transcriptionRequest = {
  videos: extractedVideos.map(video => ({
    id: video.id,
    url: video.download_url,
    platform: video.platform,
    description: video.description
  })),
  options: { includeTimestamps: true }
};

// Send to transcription API
const response = await fetch('/api/transcribe-videos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(transcriptionRequest)
});
```

### Google Drive Storage

Results are automatically saved to Google Drive with:
- Timestamped folder names
- JSON summary file
- Individual transcript files
- Organized structure

## Troubleshooting

### Common Issues

1. **"Missing Gemini API key"**
   - Get key from https://ai.google.dev/
   - Add to `.env.local` as `GEMINI_API_KEY`

2. **"File too large"**
   - Videos must be under 5MB
   - Check file size before processing

3. **"Invalid response format"**
   - Usually indicates API quota exceeded
   - Check Gemini API usage limits

4. **"Download timeout"**
   - Video URL may be expired
   - Re-extract URLs and try again

### Debug Logging

All modules include detailed console logging:

```
[VideoDownloader] Starting download for tiktok video: abc123
[VideoDownloader] Successfully downloaded abc123: 2.3 MB in 1250ms
[GeminiClient] Starting transcription for video: abc123
[GeminiClient] Successfully transcribed abc123 in 3400ms
[TranscriptionService] Job completed in 5200ms: 1 successful, 0 failed
```

### Health Check

```bash
curl http://localhost:3001/api/transcribe-videos
```

Returns service status and configuration validation.

## Performance Considerations

- **Sequential processing**: Videos processed one at a time to respect rate limits
- **Memory efficient**: Streams video data, doesn't store in memory
- **Timeout protection**: Prevents hanging requests
- **Error isolation**: One failure doesn't stop the batch

## Future Enhancements

Potential improvements:
- Parallel processing with smarter rate limiting
- Video chunking for larger files
- Multiple transcription providers
- Real-time progress updates
- Caching for repeated requests

## Support

For issues or questions:
1. Check the debug logs
2. Validate environment setup
3. Test with minimal request
4. Review error messages for specific guidance 