import { NextRequest, NextResponse } from 'next/server';
import { TranscriptionService } from '@/lib/transcription/transcription-service';
import { TranscriptionRequest, VideoMetadata } from '@/lib/transcription/types';
import { uploadToGoogleDrive } from '@/lib/google-drive';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('[TranscribeAPI] Received transcription request');
    
    // Parse request body
    const body = await request.json();
    console.log('[TranscribeAPI] Request body:', JSON.stringify(body, null, 2));
    
    // Check for fast mode
    const isFastMode = body.options?.fastMode === true;
    console.log(`[TranscribeAPI] Processing mode: ${isFastMode ? 'FAST' : 'STANDARD'}`);
    
    // Validate request
    const validation = TranscriptionService.validateRequest(body);
    if (!validation.valid) {
      console.error('[TranscribeAPI] Request validation failed:', validation.errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request', 
          details: validation.errors 
        },
        { status: 400 }
      );
    }

    // Check for required environment variables
    if (!process.env.GEMINI_API_KEY) {
      console.error('[TranscribeAPI] Missing GEMINI_API_KEY environment variable');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Server configuration error: Missing Gemini API key' 
        },
        { status: 500 }
      );
    }

    // Initialize transcription service
    const transcriptionService = new TranscriptionService();
    
    // Process transcription request with appropriate method
    console.log(`[TranscribeAPI] Starting ${isFastMode ? 'FAST' : 'standard'} transcription for ${body.videos.length} videos`);
    
    let result;
    if (isFastMode) {
      result = await transcriptionService.transcribeVideosFast(body.videos, body.options);
    } else {
      result = await transcriptionService.processTranscriptionRequest(body as TranscriptionRequest);
    }
    
    // Save results to Google Drive if any transcriptions were successful
    let driveResults = null;
    if (result.success && result.results.some(r => r.success)) {
      try {
        console.log('[TranscribeAPI] Saving results to Google Drive');
        driveResults = await saveTranscriptionResults(result, body);
        console.log('[TranscribeAPI] Successfully saved to Google Drive:', driveResults);
      } catch (driveError) {
        console.error('[TranscribeAPI] Failed to save to Google Drive:', driveError);
        // Don't fail the entire request if Google Drive upload fails
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[TranscribeAPI] Request completed in ${totalTime}ms (${isFastMode ? 'FAST MODE' : 'STANDARD MODE'})`);

    // Return response
    return NextResponse.json({
      success: result.success,
      data: {
        transcriptionResults: result.results,
        summary: {
          totalVideos: result.totalProcessed,
          successful: result.totalProcessed - result.totalFailed,
          failed: result.totalFailed,
          processingTime: result.processingTime,
          mode: isFastMode ? 'fast' : 'standard'
        },
        googleDrive: driveResults,
        errors: result.errors.length > 0 ? result.errors : undefined
      },
      timestamp: new Date().toISOString(),
      processingTime: totalTime
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[TranscribeAPI] Request failed after ${totalTime}ms:`, error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        processingTime: totalTime
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[TranscribeAPI] Health check requested');
    
    const transcriptionService = new TranscriptionService();
    const healthStatus = await transcriptionService.getHealthStatus();
    
    return NextResponse.json({
      service: 'video-transcription',
      ...healthStatus,
      endpoints: {
        transcribe: '/api/transcribe-videos (POST)',
        health: '/api/transcribe-videos (GET)'
      }
    });
    
  } catch (error) {
    console.error('[TranscribeAPI] Health check failed:', error);
    
    return NextResponse.json(
      {
        service: 'video-transcription',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Save transcription results to Google Drive
 */
async function saveTranscriptionResults(
  result: any,
  originalRequest: TranscriptionRequest
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folderName = `Marketing_Analysis_${timestamp}`;
  
  // Create summary data
  const summaryData = {
    jobInfo: {
      timestamp: new Date().toISOString(),
      totalVideos: result.totalProcessed,
      successful: result.totalProcessed - result.totalFailed,
      failed: result.totalFailed,
      processingTime: result.processingTime
    },
    options: originalRequest.options || {},
    results: result.results.map((r: any) => ({
      videoId: r.videoId,
      platform: r.platform,
      success: r.success,
      transcription: r.transcription,
      marketingSegments: r.marketingSegments,
      processingTime: r.processingTime,
      error: r.error
    })),
    errors: result.errors
  };

  // Create individual transcription files for successful results
  const files = [];
  
  // Add summary file
  files.push({
    name: 'marketing-analysis-summary.json',
    content: JSON.stringify(summaryData, null, 2),
    mimeType: 'application/json'
  });

  // Add individual marketing analysis files
  const successfulResults = result.results.filter((r: any) => r.success);
  for (const transcriptionResult of successfulResults) {
    const fileName = `${transcriptionResult.platform}_${transcriptionResult.videoId}_marketing_analysis.txt`;
    let content = `Video: ${transcriptionResult.videoUrl}\n`;
    content += `Platform: ${transcriptionResult.platform}\n`;
    content += `Processing Time: ${transcriptionResult.processingTime}ms\n`;
    content += `Timestamp: ${new Date().toISOString()}\n\n`;
    
    // Add marketing segments if available
    if (transcriptionResult.marketingSegments) {
      content += `MARKETING SEGMENTS:\n`;
      content += `🎣 Hook: ${transcriptionResult.marketingSegments.Hook}\n\n`;
      content += `🌉 Bridge: ${transcriptionResult.marketingSegments.Bridge}\n\n`;
      content += `💎 Golden Nugget: ${transcriptionResult.marketingSegments["Golden Nugget"]}\n\n`;
      content += `🎯 WTA (Why To Act): ${transcriptionResult.marketingSegments.WTA}\n\n`;
      content += `${'='.repeat(50)}\n\n`;
    }
    
    // Add word assignments if available
    if (transcriptionResult.wordAssignments && transcriptionResult.wordAssignments.length > 0) {
      content += `WORD-LEVEL CATEGORY ASSIGNMENTS:\n`;
      
      // Sort by position
      const sortedWords = transcriptionResult.wordAssignments.sort((a: any, b: any) => a.position - b.position);
      
      // Group by category for summary
      const categoryGroups = {
        Hook: sortedWords.filter((w: any) => w.category === 'Hook'),
        Bridge: sortedWords.filter((w: any) => w.category === 'Bridge'),
        'Golden Nugget': sortedWords.filter((w: any) => w.category === 'Golden Nugget'),
        WTA: sortedWords.filter((w: any) => w.category === 'WTA')
      };
      
      // Add category statistics
      content += `\nCategory Distribution:\n`;
      Object.entries(categoryGroups).forEach(([category, words]) => {
        const percentage = ((words.length / sortedWords.length) * 100).toFixed(1);
        content += `- ${category}: ${words.length} words (${percentage}%)\n`;
      });
      
      content += `\nWord-by-Word Assignment:\n`;
      sortedWords.forEach((assignment: any, index: number) => {
        content += `${assignment.position}. [${assignment.category}] ${assignment.word}\n`;
      });
      
      content += `\n${'='.repeat(50)}\n\n`;
    }
    
    content += `FULL TRANSCRIPTION:\n${transcriptionResult.transcription}\n`;

    files.push({
      name: fileName,
      content,
      mimeType: 'text/plain'
    });

    // Also create a separate JSON file with structured data
    const jsonFileName = `${transcriptionResult.platform}_${transcriptionResult.videoId}_data.json`;
    const jsonContent = {
      video: {
        id: transcriptionResult.videoId,
        url: transcriptionResult.videoUrl,
        platform: transcriptionResult.platform
      },
      analysis: {
        transcription: transcriptionResult.transcription,
        marketingSegments: transcriptionResult.marketingSegments,
        wordAssignments: transcriptionResult.wordAssignments,
        processingTime: transcriptionResult.processingTime,
        timestamp: new Date().toISOString()
      }
    };

    files.push({
      name: jsonFileName,
      content: JSON.stringify(jsonContent, null, 2),
      mimeType: 'application/json'
    });
  }

  // Upload to Google Drive
  const uploadResults = await uploadToGoogleDrive(files, folderName);
  
  return {
    folderName,
    folderUrl: uploadResults.folderUrl,
    files: uploadResults.files.map(f => ({
      name: f.name,
      url: f.url
    }))
  };
} 