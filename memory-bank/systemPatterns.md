# System Patterns

## Architecture Overview
The application follows a clean Next.js App Router architecture with clear separation of concerns:

```
├── app/
│   ├── creator/page.tsx          # Dedicated creator processing page
│   └── api/process-creator/      # API route for backend processing
├── components/
│   ├── feature/creator-processor.tsx  # Main processing component
│   ├── ui/                       # shadcn/ui components
│   └── site-header.tsx          # Navigation with Creator Tool link
└── lib/
    └── google-drive.ts          # Google Drive utility functions
```

## Key Technical Decisions

### 1. API Route Design
- **Single endpoint**: `/api/process-creator` handles both TikTok and Instagram
- **Platform-specific logic**: Branching logic based on platform parameter
- **Comprehensive error handling**: Detailed logging and user-friendly error messages
- **Rate limiting**: Built-in delays and client-side request limiting

### 2. Video Processing Strategy
- **Smallest file selection**: Prioritizes efficiency for transcription
- **Multiple URL fallbacks**: Redundant URL sources for reliability
- **Quality tracking**: Preserves video dimensions and bitrate information
- **Content filtering**: Only processes actual video content (media_type === 2 for Instagram)

### 3. Google Drive Integration
- **Service account authentication**: Secure, automated access
- **Folder organization**: Timestamped folders with descriptive names
- **Metadata preservation**: Complete JSON files with all extraction data
- **Graceful degradation**: Process continues even if Drive upload fails

### 4. Frontend State Management
- **Client-side rate limiting**: Prevents API abuse at the UI level
- **Real-time status updates**: Progressive feedback during processing
- **Request cancellation**: User can abort ongoing requests
- **Error isolation**: API failures don't break the entire interface

## Component Relationships

### Data Flow
1. **User Input** → CreatorProcessor component
2. **API Request** → /api/process-creator route
3. **External APIs** → RapidAPI for content extraction
4. **Data Processing** → Video URL extraction and filtering
5. **Storage** → Google Drive archiving
6. **UI Updates** → Real-time feedback and result display

### Error Handling Hierarchy
1. **Environment validation** (API keys, configuration)
2. **Input validation** (username format, platform selection)
3. **API error handling** (rate limits, network failures)
4. **Processing errors** (video extraction failures)
5. **Storage errors** (Google Drive upload issues)

## Design Patterns Used
- **Factory Pattern**: Platform-specific processing logic
- **Observer Pattern**: Real-time status updates
- **Circuit Breaker**: Rate limiting and API failure handling
- **Repository Pattern**: Google Drive operations abstraction
- **Command Pattern**: Request cancellation and abort handling 