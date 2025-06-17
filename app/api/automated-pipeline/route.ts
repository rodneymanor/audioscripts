import { NextRequest, NextResponse } from 'next/server';
import { TrainingDataExporter, type ExportOptions } from '@/lib/transcription/training-data-exporter';
import { TemplateGenerator } from '@/lib/transcription/template-generator';
import type { MarketingSegments, TranscriptionResult } from '@/lib/transcription/types';

interface AutomatedPipelineRequest {
  username: string;
  platform: 'tiktok' | 'instagram';
  videoCount?: number;
  options?: {
    fastMode?: boolean;
    generateSyntheticData?: boolean;
    syntheticScriptCount?: number;
    exportFormat?: 'jsonl' | 'json';
    includeMetadata?: boolean;
  };
}

interface PipelineProgress {
  stage: 'extraction' | 'transcription' | 'template_generation' | 'synthetic_generation' | 'export' | 'complete';
  message: string;
  progress: number; // 0-100
  data?: any;
}

export async function POST(req: NextRequest) {
  try {
    const body: AutomatedPipelineRequest = await req.json();
    const { 
      username, 
      platform, 
      videoCount = 40,
      options = {}
    } = body;

    const {
      fastMode = false, // Default to marketing analysis for fine-tuning
      generateSyntheticData = true,
      syntheticScriptCount = 10,
      exportFormat = 'jsonl',
      includeMetadata = true
    } = options;

    console.log(`[AutomatedPipeline] Starting automated pipeline for ${platform}:${username}`);
    console.log(`[AutomatedPipeline] Configuration:`, {
      videoCount,
      fastMode,
      generateSyntheticData,
      syntheticScriptCount,
      exportFormat
    });

    // Step 1: Extract Videos
    console.log(`[AutomatedPipeline] Step 1: Extracting top ${videoCount} videos from ${platform}:${username}`);
    
    const extractionResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/process-creator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        platform,
        videoCount
      })
    });

    if (!extractionResponse.ok) {
      const error = await extractionResponse.json();
      throw new Error(`Video extraction failed: ${error.error || 'Unknown error'}`);
    }

    const extractionResult = await extractionResponse.json();
    
    if (!extractionResult.success || !extractionResult.extractedVideos?.length) {
      throw new Error('No videos extracted successfully');
    }

    console.log(`[AutomatedPipeline] Extracted ${extractionResult.extractedVideos.length} videos`);

    // Step 2: Transcribe and Analyze Videos
    console.log(`[AutomatedPipeline] Step 2: Transcribing and analyzing ${extractionResult.extractedVideos.length} videos`);
    
    const transcriptionRequest = {
      videos: extractionResult.extractedVideos
        .filter((video: any) => video.video_url)
        .map((video: any) => ({
          id: video.id,
          url: video.video_url,
          platform: video.platform,
          description: `${video.platform} video - ${video.quality}`,
          viewCount: video.viewCount,
          likeCount: video.likeCount
        })),
      options: {
        extractMarketingSegments: !fastMode,
        fastMode: fastMode,
        includeVisualDescriptions: false,
        model: 'gemini-2.0-flash' as const
      }
    };

    const transcriptionResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/transcribe-videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transcriptionRequest)
    });

    if (!transcriptionResponse.ok) {
      const error = await transcriptionResponse.json();
      throw new Error(`Transcription failed: ${error.error || 'Unknown error'}`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    
    if (!transcriptionResult.success || !transcriptionResult.data?.transcriptionResults?.length) {
      throw new Error('No videos transcribed successfully');
    }

    const successfulTranscriptions = transcriptionResult.data.transcriptionResults.filter(
      (result: any) => result.success && result.marketingSegments
    );

    console.log(`[AutomatedPipeline] Successfully analyzed ${successfulTranscriptions.length} videos`);

    // Step 3: Generate Templates (if we have marketing analysis)
    let templates: any[] = [];
    if (!fastMode && successfulTranscriptions.length > 0) {
      console.log(`[AutomatedPipeline] Step 3: Generating templates from successful scripts`);
      
      try {
        const templateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcriptionResults: successfulTranscriptions,
            options: {
              generateVariations: true,
              maxTemplates: 20
            }
          })
        });

        if (templateResponse.ok) {
          const templateResult = await templateResponse.json();
          templates = templateResult.data?.allTemplates || [];
          console.log(`[AutomatedPipeline] Generated ${templates.length} templates`);
        }
      } catch (error) {
        console.warn(`[AutomatedPipeline] Template generation failed:`, error);
        // Continue without templates
      }
    }

    // Step 4: Generate Synthetic Scripts (if requested and we have marketing analysis)
    let syntheticScripts: Array<{topic: string, script: MarketingSegments}> = [];
    if (generateSyntheticData && !fastMode && templates.length > 0) {
      console.log(`[AutomatedPipeline] Step 4: Generating ${syntheticScriptCount} synthetic scripts`);
      
      const syntheticTopics = [
        'productivity tips for entrepreneurs',
        'social media growth strategies',
        'healthy morning routines',
        'fitness motivation for beginners',
        'business advice for startups',
        'personal development habits',
        'technology trends 2024',
        'creative content ideas',
        'financial literacy basics',
        'time management techniques'
      ].slice(0, syntheticScriptCount);

      for (const topic of syntheticTopics) {
        try {
          const syntheticResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              syntheticTopic: topic,
              templates: templates.slice(0, 3) // Use top 3 templates for variety
            })
          });

          if (syntheticResponse.ok) {
            const syntheticResult = await syntheticResponse.json();
            if (syntheticResult.success && syntheticResult.data?.script) {
              syntheticScripts.push({
                topic,
                script: syntheticResult.data.script
              });
            }
          }
          
          // Small delay between synthetic generations
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.warn(`[AutomatedPipeline] Failed to generate synthetic script for "${topic}":`, error);
        }
      }
      
      console.log(`[AutomatedPipeline] Generated ${syntheticScripts.length} synthetic scripts`);
    }

    // Step 5: Export Training Data
    console.log(`[AutomatedPipeline] Step 5: Exporting training dataset`);
    
    const exportOptions: ExportOptions = {
      includeMetadata,
      includeOriginalTranscriptions: true,
      includeSyntheticScripts: syntheticScripts.length > 0,
      maxExamplesPerVideo: 10,
      minViewCount: 0
    };

    const exportResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/export-training-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcriptionResults: successfulTranscriptions,
        templates,
        syntheticScripts,
        options: exportOptions,
        format: exportFormat
      })
    });

    if (!exportResponse.ok) {
      const error = await exportResponse.json();
      throw new Error(`Training data export failed: ${error.error || 'Unknown error'}`);
    }

    const exportResult = await exportResponse.json();
    
    console.log(`[AutomatedPipeline] Pipeline completed successfully`);

    // Return comprehensive results
    return NextResponse.json({
      success: true,
      data: {
        pipeline: {
          username,
          platform,
          videoCount,
          processingMode: fastMode ? 'fast' : 'marketing_analysis',
          completedAt: new Date().toISOString()
        },
        extraction: {
          totalVideos: extractionResult.extractedVideos.length,
          googleDrive: extractionResult.googleDrive
        },
        transcription: {
          totalProcessed: transcriptionResult.data.summary.totalVideos,
          successful: transcriptionResult.data.summary.successful,
          failed: transcriptionResult.data.summary.failed,
          processingTime: transcriptionResult.data.summary.processingTime,
          googleDrive: transcriptionResult.data.googleDrive
        },
        templates: {
          generated: templates.length,
          templates: templates
        },
        synthetic: {
          generated: syntheticScripts.length,
          scripts: syntheticScripts
        },
        trainingData: {
          format: exportFormat,
          totalExamples: exportResult.data?.dataset?.examples?.length || 0,
          summary: exportResult.data?.dataset?.summary,
          downloadUrl: exportResult.data?.downloadUrl,
          metadata: exportResult.data?.dataset?.metadata
        }
      },
      message: `Automated pipeline completed: ${successfulTranscriptions.length} videos analyzed, ${templates.length} templates generated, ${syntheticScripts.length} synthetic scripts created, ${exportResult.data?.dataset?.examples?.length || 0} training examples ready for fine-tuning`
    });

  } catch (error) {
    console.error('[AutomatedPipeline] Pipeline failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stage: 'pipeline_error'
    }, { status: 500 });
  }
}

// GET endpoint for pipeline status/health check
export async function GET() {
  return NextResponse.json({
    service: 'Automated Pipeline',
    status: 'ready',
    capabilities: [
      'Video extraction from TikTok/Instagram',
      'Automated transcription and marketing analysis',
      'Template generation from successful content',
      'Synthetic script generation',
      'Training data export (JSONL/JSON)',
      'Google Drive integration',
      'End-to-end automation'
    ],
    supportedPlatforms: ['tiktok', 'instagram'],
    processingModes: ['fast', 'marketing_analysis'],
    exportFormats: ['jsonl', 'json']
  });
} 