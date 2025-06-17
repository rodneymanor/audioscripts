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

interface PipelineStep {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message: string;
  details?: any;
  timestamp: string;
}

// Server-Sent Events for real-time updates
class PipelineProgressTracker {
  private steps: PipelineStep[] = [];

  addStep(step: string, status: 'pending' | 'running' | 'completed' | 'failed', message: string, details?: any) {
    const stepData: PipelineStep = {
      step,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    
    this.steps.push(stepData);
    console.log(`[Pipeline Step] ${step}: ${status} - ${message}`);
    
    if (details) {
      console.log(`[Pipeline Details]`, details);
    }
  }

  getSteps() {
    return this.steps;
  }

  updateLastStep(status: 'pending' | 'running' | 'completed' | 'failed', message: string, details?: any) {
    if (this.steps.length > 0) {
      const lastStep = this.steps[this.steps.length - 1];
      lastStep.status = status;
      lastStep.message = message;
      if (details) lastStep.details = details;
      lastStep.timestamp = new Date().toISOString();
    }
  }
}

export async function POST(req: NextRequest) {
  const tracker = new PipelineProgressTracker();
  
  try {
    const body: AutomatedPipelineRequest = await req.json();
    const { 
      username, 
      platform, 
      videoCount = 40,
      options = {}
    } = body;

    const {
      fastMode = false,
      generateSyntheticData = true,
      syntheticScriptCount = 10,
      exportFormat = 'jsonl',
      includeMetadata = true
    } = options;

    tracker.addStep('initialization', 'completed', `Starting automated pipeline for ${platform}:${username}`, {
      videoCount,
      fastMode,
      generateSyntheticData,
      syntheticScriptCount,
      exportFormat
    });

    // Step 1: Extract Videos
    tracker.addStep('video_extraction', 'running', `Extracting top ${videoCount} videos from ${platform}:${username}`);
    
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
      tracker.updateLastStep('failed', `Video extraction failed: ${error.error || 'Unknown error'}`);
      throw new Error(`Video extraction failed: ${error.error || 'Unknown error'}`);
    }

    const extractionResult = await extractionResponse.json();
    
    if (!extractionResult.success || !extractionResult.extractedVideos?.length) {
      tracker.updateLastStep('failed', 'No videos extracted successfully');
      throw new Error('No videos extracted successfully');
    }

    // Show extracted video URLs
    const videoUrls = extractionResult.extractedVideos.map((video: any, index: number) => ({
      index: index + 1,
      id: video.id,
      url: video.video_url,
      platform: video.platform,
      viewCount: video.viewCount || 0,
      quality: video.quality
    }));

    tracker.updateLastStep('completed', `Successfully extracted ${extractionResult.extractedVideos.length} video URLs`, {
      totalVideos: extractionResult.extractedVideos.length,
      videoUrls: videoUrls,
      googleDrive: extractionResult.googleDrive
    });

    // Step 2: Download and Transcribe Videos
    tracker.addStep('video_processing', 'running', `Downloading and ${fastMode ? 'transcribing' : 'analyzing'} ${extractionResult.extractedVideos.length} videos`);
    
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
      tracker.updateLastStep('failed', `Transcription failed: ${error.error || 'Unknown error'}`);
      throw new Error(`Transcription failed: ${error.error || 'Unknown error'}`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    
    if (!transcriptionResult.success || !transcriptionResult.data?.transcriptionResults?.length) {
      tracker.updateLastStep('failed', 'No videos transcribed successfully');
      throw new Error('No videos transcribed successfully');
    }

    const successfulTranscriptions = transcriptionResult.data.transcriptionResults.filter(
      (result: any) => result.success && result.marketingSegments
    );

    // Log success rate for debugging
    const totalAttempted = transcriptionResult.data.transcriptionResults.length;
    const successRate = Math.round((successfulTranscriptions.length / totalAttempted) * 100);
    
    // Continue even if success rate is low, but warn if too low
    if (successfulTranscriptions.length === 0) {
      tracker.updateLastStep('failed', 'No videos were successfully transcribed and analyzed');
      throw new Error('No videos were successfully transcribed and analyzed');
    }
    
    // Show detailed transcription results
    const transcriptionDetails = {
      successRate: `${successRate}% (${successfulTranscriptions.length}/${totalAttempted})`,
      processingTime: transcriptionResult.data.summary.processingTime,
      googleDrive: transcriptionResult.data.googleDrive,
      successful: successfulTranscriptions.map((result: any) => ({
        videoId: result.videoId,
        platform: result.platform,
        transcription: result.transcription.substring(0, 200) + '...',
        marketingSegments: result.marketingSegments,
        processingTime: result.processingTime
      })),
      failed: transcriptionResult.data.transcriptionResults
        .filter((result: any) => !result.success)
        .map((result: any) => ({
          videoId: result.videoId,
          error: result.error
        }))
    };

    if (successRate < 50) {
      tracker.updateLastStep('completed', `⚠️ Low success rate: ${successRate}% - many videos may have expired URLs`, transcriptionDetails);
    } else {
      tracker.updateLastStep('completed', `Successfully processed ${successfulTranscriptions.length} videos (${successRate}% success rate)`, transcriptionDetails);
    }

    // Step 3: Google Drive Storage
    if (transcriptionResult.data.googleDrive) {
      tracker.addStep('drive_storage', 'completed', `Google Drive folder created: ${transcriptionResult.data.googleDrive.folderName}`, {
        folderName: transcriptionResult.data.googleDrive.folderName,
        folderUrl: transcriptionResult.data.googleDrive.folderUrl,
        files: transcriptionResult.data.googleDrive.files || []
      });
    }

    // Step 4: Generate Templates (if we have marketing analysis)
    let templates: any[] = [];
    if (!fastMode && successfulTranscriptions.length > 0) {
      tracker.addStep('template_generation', 'running', `Generating templates from ${successfulTranscriptions.length} successful scripts`);
      
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
          
          tracker.updateLastStep('completed', `Generated ${templates.length} content templates`, {
            templates: templates.map((template: any, index: number) => ({
              index: index + 1,
              hook: template.hook.substring(0, 100) + '...',
              bridge: template.bridge.substring(0, 100) + '...',
              nugget: template.nugget.substring(0, 100) + '...',
              wta: template.wta.substring(0, 100) + '...'
            }))
          });
        } else {
          tracker.updateLastStep('failed', 'Template generation failed');
        }
      } catch (error) {
        tracker.updateLastStep('failed', `Template generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Step 5: Generate Synthetic Scripts (if requested and we have marketing analysis)
    let syntheticScripts: Array<{topic: string, script: MarketingSegments}> = [];
    if (generateSyntheticData && !fastMode && templates.length > 0) {
      tracker.addStep('synthetic_generation', 'running', `Generating ${syntheticScriptCount} synthetic training scripts`);
      
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

      let successfulSynthetic = 0;
      const syntheticDetails: any[] = [];

      for (const topic of syntheticTopics) {
        try {
          const syntheticResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              syntheticTopic: topic,
              templates: templates.slice(0, 3)
            })
          });

          if (syntheticResponse.ok) {
            const syntheticResult = await syntheticResponse.json();
            if (syntheticResult.success && syntheticResult.data?.script) {
              syntheticScripts.push({
                topic,
                script: syntheticResult.data.script
              });
              
              successfulSynthetic++;
              syntheticDetails.push({
                topic,
                hook: syntheticResult.data.script.Hook.substring(0, 100) + '...',
                status: 'success'
              });
            } else {
              syntheticDetails.push({
                topic,
                status: 'failed',
                error: 'No script generated'
              });
            }
          } else {
            syntheticDetails.push({
              topic,
              status: 'failed',
              error: 'API request failed'
            });
          }
          
          // Small delay between synthetic generations
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          syntheticDetails.push({
            topic,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      tracker.updateLastStep('completed', `Generated ${successfulSynthetic}/${syntheticScriptCount} synthetic scripts`, {
        successfulSynthetic,
        totalAttempted: syntheticScriptCount,
        details: syntheticDetails
      });
    }

    // Step 6: Export Training Data
    tracker.addStep('data_export', 'running', 'Preparing training dataset for fine-tuning');
    
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
      tracker.updateLastStep('failed', `Training data export failed: ${error.error || 'Unknown error'}`);
      throw new Error(`Training data export failed: ${error.error || 'Unknown error'}`);
    }

    const exportResult = await exportResponse.json();
    
    tracker.updateLastStep('completed', `Training dataset ready: ${exportResult.data?.dataset?.examples?.length || 0} examples in ${exportFormat.toUpperCase()} format`, {
      totalExamples: exportResult.data?.dataset?.examples?.length || 0,
      format: exportFormat,
      downloadUrl: exportResult.data?.downloadUrl,
      summary: exportResult.data?.dataset?.summary
    });

    // Final completion step
    tracker.addStep('pipeline_complete', 'completed', 'Automated pipeline completed successfully!', {
      totalSteps: tracker.getSteps().length,
      completedAt: new Date().toISOString()
    });

    // Return comprehensive results with detailed steps
    return NextResponse.json({
      success: true,
      steps: tracker.getSteps(),
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
          videoUrls: videoUrls,
          googleDrive: extractionResult.googleDrive
        },
        transcription: {
          totalProcessed: transcriptionResult.data.summary.totalVideos,
          successful: transcriptionResult.data.summary.successful,
          failed: transcriptionResult.data.summary.failed,
          processingTime: transcriptionResult.data.summary.processingTime,
          googleDrive: transcriptionResult.data.googleDrive,
          results: successfulTranscriptions
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
      message: `Pipeline completed: ${successfulTranscriptions.length} videos analyzed, ${templates.length} templates generated, ${syntheticScripts.length} synthetic scripts created, ${exportResult.data?.dataset?.examples?.length || 0} training examples ready`
    });

  } catch (error) {
    console.error('[AutomatedPipeline] Pipeline failed:', error);
    
    // Add failure step
    const tracker_copy = tracker;
    tracker_copy.addStep('pipeline_failed', 'failed', error instanceof Error ? error.message : 'Unknown error occurred');
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      steps: tracker_copy.getSteps(),
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
      'End-to-end automation',
      'Real-time progress tracking'
    ],
    supportedPlatforms: ['tiktok', 'instagram'],
    processingModes: ['fast', 'marketing_analysis'],
    exportFormats: ['jsonl', 'json']
  });
} 