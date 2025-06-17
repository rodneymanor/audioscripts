# AudioScripts - Social Media Content Processor

## Project Goal
Build an application that allows users to input social media profile usernames (TikTok/Instagram) and automatically downloads recent videos, transcribes them, and processes them for AI fine-tuning.

## Core Requirements
- **Input**: Social media username (TikTok or Instagram)
- **Output**: Downloaded videos + transcriptions ready for AI training
- **Platforms**: TikTok and Instagram content extraction
- **Storage**: Google Drive integration for archiving
- **Processing**: Video transcription for AI fine-tuning data

## Technical Scope
- Next.js application with App Router
- RapidAPI integration for social media content access
- Google Drive API for cloud storage
- Rate limiting and error handling
- Iterative development approach

## Success Criteria
1. Successfully extract up to 10 videos per creator request
2. Identify smallest video files suitable for transcription
3. Archive all content and metadata to Google Drive
4. Provide user-friendly interface with real-time feedback
5. Handle API rate limits and errors gracefully

## Development Philosophy
- Take an iterative approach - build and test incrementally
- Focus on core functionality before advanced features
- Comprehensive error logging for debugging
- Clean, maintainable code structure
- User experience focused on simplicity and clarity 