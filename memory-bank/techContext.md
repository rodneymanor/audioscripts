# Technical Context

## Technologies Used

### Frontend Stack
- **Next.js 14** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Magic UI** for enhanced components
- **Lucide React** for icons

### Backend & APIs
- **Next.js API Routes** (App Router)
- **RapidAPI** for social media content access
  - TikTok API endpoint: `/tiktok/user_feed`
  - Instagram API endpoints: `/instagram/user_info` + `/instagram/user_posts`
- **Google Drive API** for cloud storage
- **Google Service Account** authentication

### Development Tools
- **pnpm** for package management
- **TypeScript** for type safety
- **ESLint** for code quality
- **PostCSS** for CSS processing

## Environment Configuration

### Required Environment Variables
```bash
RAPIDAPI_KEY=7d8697833dmsh0919d85dc19515ap1175f7jsn0f8bb6dae84e
GOOGLE_DRIVE_PARENT_FOLDER_ID=1wz1KqPPyQpK1j-9PJvcEYnXQQH9DiE3C
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=downloader@genc-a8f49.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY=[base64 encoded private key]
```

### Development Setup
- **Port**: 3001 (3000 was in use)
- **Development server**: `npm run dev`
- **Node.js version**: Latest LTS
- **Package manager**: pnpm

## API Endpoints & Rate Limits

### TikTok API (RapidAPI)
- **Endpoint**: `https://tiktok-scraper7.p.rapidapi.com/user/posts`
- **Rate Limit**: Standard RapidAPI limits
- **Response**: Direct feed with `aweme_list` array
- **Video Processing**: Extracts from `play_addr` and `download_addr`

### Instagram API (RapidAPI)
- **Step 1**: `https://instagram-scraper-2022.p.rapidapi.com/ig/user_info`
- **Step 2**: `https://instagram-scraper-2022.p.rapidapi.com/ig/posts`
- **Rate Limit**: Per-second limitations (handled with 1s delays)
- **Response**: Two-step process (username → user_id → posts)
- **Video Processing**: Extracts from `items` array, media_type === 2

### Google Drive API
- **Authentication**: Service Account with OAuth2
- **Permissions**: Editor access to parent folder
- **Operations**: Create folders, upload files
- **File Types**: JSON metadata, future video files

## Technical Constraints

### Rate Limiting
- **Client-side**: 5 requests per minute per user
- **Instagram**: 1-second delay between API calls
- **Error handling**: Graceful degradation on rate limit hits

### Video Processing
- **File Selection**: Smallest available bitrate/resolution
- **Content Limits**: Up to 10 videos per request
- **URL Extraction**: Multiple fallback sources
- **Quality Tracking**: Preserve original quality metadata

### Storage Constraints
- **Google Drive**: Service account quotas
- **Folder Structure**: Timestamped organization
- **Metadata**: Complete JSON preservation
- **File Naming**: Sanitized, collision-resistant

## Dependencies

### Core Dependencies
```json
{
  "next": "14.x",
  "react": "18.x",
  "typescript": "5.x",
  "tailwindcss": "3.x",
  "googleapis": "latest"
}
```

### Development Dependencies
- **@types/node**: Node.js type definitions
- **eslint**: Code linting
- **postcss**: CSS processing
- **autoprefixer**: CSS vendor prefixes 