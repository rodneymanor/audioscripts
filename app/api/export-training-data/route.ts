import { NextRequest, NextResponse } from 'next/server';
import { TrainingDataExporter, ExportOptions } from '@/lib/transcription/training-data-exporter';
import { TranscriptionResult, ScriptTemplate } from '@/lib/transcription/types';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('[ExportAPI] Received training data export request');
    
    // Parse request body
    const body = await request.json();
    console.log('[ExportAPI] Request body keys:', Object.keys(body));
    
    const { 
      transcriptionResults, 
      templates, 
      syntheticScripts = [],
      options = {},
      action = 'generate'
    } = body;
    
    // Only validate transcriptionResults and templates for 'generate' action
    if (action === 'generate') {
      if (!transcriptionResults || !Array.isArray(transcriptionResults)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Missing or invalid transcriptionResults array' 
          },
          { status: 400 }
        );
      }

      if (!templates || !Array.isArray(templates)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Missing or invalid templates array' 
          },
          { status: 400 }
        );
      }
    }

    if (action === 'generate') {
      console.log(`[ExportAPI] Processing ${transcriptionResults.length} transcriptions, ${templates.length} templates, and ${syntheticScripts.length} synthetic scripts`);
    } else {
      console.log(`[ExportAPI] Processing download request for action: ${action}`);
    }

    if (action === 'generate') {
      // Generate training dataset
      const exportOptions: ExportOptions = {
        includeMetadata: options.includeMetadata ?? true,
        includeOriginalTranscriptions: options.includeOriginalTranscriptions ?? true,
        includeSyntheticScripts: options.includeSyntheticScripts ?? true,
        syntheticTopics: options.syntheticTopics,
        maxExamplesPerVideo: options.maxExamplesPerVideo ?? 10,
        minViewCount: options.minViewCount ?? 0,
        format: options.format ?? 'jsonl'
      };

      console.log('[ExportAPI] Generating training dataset with options:', exportOptions);
      
      const dataset = await TrainingDataExporter.generateTrainingDataset(
        transcriptionResults as TranscriptionResult[],
        templates as ScriptTemplate[],
        syntheticScripts,
        exportOptions
      );

      // Validate dataset
      const validation = TrainingDataExporter.validateDataset(dataset);
      
      const totalTime = Date.now() - startTime;
      console.log(`[ExportAPI] Dataset generation completed in ${totalTime}ms`);

      return NextResponse.json({
        success: true,
        data: {
          dataset,
          validation,
          processingTime: totalTime
        },
        timestamp: new Date().toISOString()
      });

    } else if (action === 'download') {
      // Generate and prepare download
      const { dataset, format = 'jsonl', includeMetadata = false } = body;
      
      console.log(`[ExportAPI] Download request - dataset exists: ${!!dataset}, format: ${format}, includeMetadata: ${includeMetadata}`);
      
      if (!dataset) {
        console.error('[ExportAPI] Download failed - missing dataset');
        return NextResponse.json(
          { 
            success: false, 
            error: 'Missing dataset for download' 
          },
          { status: 400 }
        );
      }

      console.log(`[ExportAPI] Preparing download in ${format} format`);
      
      const downloadContent = TrainingDataExporter.createDownloadableContent(
        dataset,
        format,
        includeMetadata
      );

      const totalTime = Date.now() - startTime;
      console.log(`[ExportAPI] Download preparation completed in ${totalTime}ms`);

      // Return the content for download
      return new NextResponse(downloadContent.content, {
        status: 200,
        headers: {
          'Content-Type': downloadContent.mimeType,
          'Content-Disposition': `attachment; filename="${downloadContent.filename}"`,
          'X-Processing-Time': totalTime.toString()
        }
      });

    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: `Unknown action: ${action}. Use "generate" or "download"` 
        },
        { status: 400 }
      );
    }

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('[ExportAPI] Request failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        processingTime: totalTime
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[ExportAPI] Health check requested');
    
    return NextResponse.json({
      service: 'training-data-export',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      endpoints: {
        generateDataset: '/api/export-training-data (POST with action: "generate")',
        downloadDataset: '/api/export-training-data (POST with action: "download")',
        health: '/api/export-training-data (GET)'
      },
      usage: {
        generateDataset: {
          method: 'POST',
          body: {
            action: 'generate',
            transcriptionResults: 'Array of TranscriptionResult objects',
            templates: 'Array of ScriptTemplate objects',
            syntheticScripts: 'Array of {topic: string, script: MarketingSegments} objects (optional)',
            options: {
              includeMetadata: 'boolean (default: true)',
              includeOriginalTranscriptions: 'boolean (default: true)',
              includeSyntheticScripts: 'boolean (default: true)',
              syntheticTopics: 'string[] (optional)',
              maxExamplesPerVideo: 'number (default: 10)',
              minViewCount: 'number (default: 0)',
              format: '"jsonl" | "json" (default: "jsonl")'
            }
          }
        },
        downloadDataset: {
          method: 'POST',
          body: {
            action: 'download',
            dataset: 'TrainingDataset object',
            format: '"jsonl" | "json" (default: "jsonl")',
            includeMetadata: 'boolean (default: false)'
          }
        }
      },
      supportedFormats: ['jsonl', 'json'],
      defaultSyntheticTopics: [
        'productivity tips',
        'social media growth',
        'healthy eating',
        'fitness motivation',
        'business advice',
        'personal development',
        'technology trends',
        'creative inspiration',
        'financial literacy',
        'relationship advice',
        'career growth',
        'mental health',
        'time management',
        'leadership skills',
        'marketing strategies'
      ]
    });
    
  } catch (error) {
    console.error('[ExportAPI] Health check failed:', error);
    
    return NextResponse.json(
      {
        service: 'training-data-export',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 