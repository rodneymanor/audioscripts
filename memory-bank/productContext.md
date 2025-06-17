# Product Context

## Why This Project Exists
The AudioScripts application solves the challenge of efficiently collecting and processing social media content for AI training data. Content creators produce valuable audio/video content that can be used to train AI models, but manually downloading and processing this content is time-consuming and error-prone.

## Problems It Solves
1. **Manual Content Collection**: Eliminates the need to manually download videos from social media platforms
2. **Content Organization**: Automatically organizes content in structured Google Drive folders
3. **Video Processing**: Identifies optimal video files for transcription (smallest sizes for efficiency)
4. **Metadata Preservation**: Saves all relevant metadata alongside content for training context
5. **Rate Limit Management**: Handles API limitations intelligently to avoid service interruptions

## How It Should Work

### User Experience Flow
1. User navigates to `/creator` page
2. Selects platform (TikTok or Instagram)
3. Enters creator username (without @ symbol)
4. Clicks "Process Content" 
5. Sees real-time status updates during processing
6. Views extracted video information with full download URLs
7. Accesses Google Drive folder with archived content

### Expected Outcomes
- **Immediate Feedback**: Real-time status updates and error messages
- **Comprehensive Data**: Complete video URLs, thumbnails, and metadata
- **Organized Storage**: Timestamped folders in Google Drive with JSON metadata
- **Scalable Processing**: Support for pagination to get more content if needed
- **Error Recovery**: Graceful handling of API failures without breaking the workflow

## User Experience Goals
- **Simplicity**: Single form with minimal required inputs
- **Transparency**: Clear logging and status messages
- **Reliability**: Robust error handling and rate limiting
- **Accessibility**: Clean, responsive UI that works across devices
- **Efficiency**: Optimized for smallest file sizes to reduce processing time 