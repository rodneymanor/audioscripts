import { NextRequest, NextResponse } from 'next/server';
import { FineTuningService, FineTuningJobConfig } from '@/lib/transcription/fine-tuning-service';
import { TrainingDataExporter } from '@/lib/transcription/training-data-exporter';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('[FineTuningAPI] Received fine-tuning request');
    
    // Parse request body
    const body = await request.json();
    console.log('[FineTuningAPI] Request body:', JSON.stringify(body, null, 2));
    
    const { action } = body;
    
    if (!action) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing action parameter. Use "start-job", "get-status", "list-jobs", "cancel-job", or "upload-dataset"' 
        },
        { status: 400 }
      );
    }

    // Check for required environment variables
    const requiredEnvVars = [
      'GOOGLE_CLOUD_PROJECT_ID',
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_PRIVATE_KEY'
    ];

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if (missingEnvVars.length > 0) {
      console.error('[FineTuningAPI] Missing environment variables:', missingEnvVars);
      return NextResponse.json(
        { 
          success: false, 
          error: `Missing required environment variables: ${missingEnvVars.join(', ')}`,
          details: 'Please configure Google Cloud credentials for fine-tuning'
        },
        { status: 500 }
      );
    }

    // Initialize fine-tuning service
    const fineTuningService = new FineTuningService();
    
    switch (action) {
      case 'start-job':
        return await handleStartJob(fineTuningService, body, startTime);
      
      case 'get-status':
        return await handleGetStatus(fineTuningService, body, startTime);
      
      case 'list-jobs':
        return await handleListJobs(fineTuningService, body, startTime);
      
      case 'cancel-job':
        return await handleCancelJob(fineTuningService, body, startTime);
      
      case 'upload-dataset':
        return await handleUploadDataset(fineTuningService, body, startTime);
      
      case 'validate-config':
        return await handleValidateConfig(fineTuningService, body, startTime);
      
      default:
        return NextResponse.json(
          { 
            success: false, 
            error: `Unknown action: ${action}. Use "start-job", "get-status", "list-jobs", "cancel-job", "upload-dataset", or "validate-config"` 
          },
          { status: 400 }
        );
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[FineTuningAPI] Request failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime
      },
      { status: 500 }
    );
  }
}

async function handleStartJob(
  fineTuningService: FineTuningService, 
  body: any, 
  startTime: number
): Promise<NextResponse> {
  const { config } = body;
  
  if (!config) {
    return NextResponse.json(
      { success: false, error: 'Missing config parameter for start-job action' },
      { status: 400 }
    );
  }

  // Validate configuration
  const validation = fineTuningService.validateConfig(config);
  if (!validation.valid) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid fine-tuning configuration',
        details: validation.errors
      },
      { status: 400 }
    );
  }

  try {
    console.log('[FineTuningAPI] Starting fine-tuning job with config:', config);
    
    const job = await fineTuningService.startFineTuningJob(config);
    const processingTime = Date.now() - startTime;
    
    console.log(`[FineTuningAPI] Fine-tuning job started successfully in ${processingTime}ms`);
    
    return NextResponse.json({
      success: true,
      data: {
        job,
        processingTime
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[FineTuningAPI] Failed to start fine-tuning job:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to start fine-tuning job: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime
      },
      { status: 500 }
    );
  }
}

async function handleGetStatus(
  fineTuningService: FineTuningService, 
  body: any, 
  startTime: number
): Promise<NextResponse> {
  const { jobName } = body;
  
  if (!jobName) {
    return NextResponse.json(
      { success: false, error: 'Missing jobName parameter for get-status action' },
      { status: 400 }
    );
  }

  try {
    console.log('[FineTuningAPI] Getting job status for:', jobName);
    
    const status = await fineTuningService.getJobStatus(jobName);
    const processingTime = Date.now() - startTime;
    
    console.log(`[FineTuningAPI] Job status retrieved successfully in ${processingTime}ms`);
    
    return NextResponse.json({
      success: true,
      data: {
        status,
        processingTime
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[FineTuningAPI] Failed to get job status:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to get job status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime
      },
      { status: 500 }
    );
  }
}

async function handleListJobs(
  fineTuningService: FineTuningService, 
  body: any, 
  startTime: number
): Promise<NextResponse> {
  const { pageSize = 10 } = body;

  try {
    console.log('[FineTuningAPI] Listing fine-tuning jobs');
    
    const jobs = await fineTuningService.listJobs(pageSize);
    const processingTime = Date.now() - startTime;
    
    console.log(`[FineTuningAPI] Listed ${jobs.length} jobs successfully in ${processingTime}ms`);
    
    return NextResponse.json({
      success: true,
      data: {
        jobs,
        count: jobs.length,
        processingTime
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[FineTuningAPI] Failed to list jobs:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to list jobs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime
      },
      { status: 500 }
    );
  }
}

async function handleCancelJob(
  fineTuningService: FineTuningService, 
  body: any, 
  startTime: number
): Promise<NextResponse> {
  const { jobName } = body;
  
  if (!jobName) {
    return NextResponse.json(
      { success: false, error: 'Missing jobName parameter for cancel-job action' },
      { status: 400 }
    );
  }

  try {
    console.log('[FineTuningAPI] Cancelling job:', jobName);
    
    await fineTuningService.cancelJob(jobName);
    const processingTime = Date.now() - startTime;
    
    console.log(`[FineTuningAPI] Job cancelled successfully in ${processingTime}ms`);
    
    return NextResponse.json({
      success: true,
      data: {
        message: 'Job cancelled successfully',
        jobName,
        processingTime
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[FineTuningAPI] Failed to cancel job:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to cancel job: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime
      },
      { status: 500 }
    );
  }
}

async function handleUploadDataset(
  fineTuningService: FineTuningService, 
  body: any, 
  startTime: number
): Promise<NextResponse> {
  const { dataset, bucketName, fileName, systemPrompt } = body;
  
  if (!dataset) {
    return NextResponse.json(
      { success: false, error: 'Missing dataset parameter for upload-dataset action' },
      { status: 400 }
    );
  }

  if (!bucketName) {
    return NextResponse.json(
      { success: false, error: 'Missing bucketName parameter for upload-dataset action' },
      { status: 400 }
    );
  }

  try {
    console.log('[FineTuningAPI] Uploading training dataset to bucket:', bucketName);
    if (systemPrompt) {
      console.log('[FineTuningAPI] System prompt will be saved alongside dataset');
    }
    
    const datasetUri = await fineTuningService.uploadTrainingDataset(dataset, bucketName, fileName, systemPrompt);
    const processingTime = Date.now() - startTime;
    
    console.log(`[FineTuningAPI] Dataset uploaded successfully in ${processingTime}ms`);
    
    return NextResponse.json({
      success: true,
      data: {
        datasetUri,
        bucketName,
        fileName: fileName || 'training-dataset.jsonl',
        systemPromptSaved: !!systemPrompt,
        processingTime
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[FineTuningAPI] Failed to upload dataset:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to upload dataset: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime
      },
      { status: 500 }
    );
  }
}

async function handleValidateConfig(
  fineTuningService: FineTuningService, 
  body: any, 
  startTime: number
): Promise<NextResponse> {
  const { config } = body;
  
  if (!config) {
    return NextResponse.json(
      { success: false, error: 'Missing config parameter for validate-config action' },
      { status: 400 }
    );
  }

  try {
    console.log('[FineTuningAPI] Validating fine-tuning configuration');
    
    // Use UI validation method that doesn't require dataset URI
    const validation = fineTuningService.validateConfigForUI(config);
    const availableModels = fineTuningService.getAvailableBaseModels();
    const processingTime = Date.now() - startTime;
    
    console.log(`[FineTuningAPI] Configuration validated in ${processingTime}ms`);
    
    return NextResponse.json({
      success: true,
      data: {
        validation,
        availableModels,
        processingTime
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[FineTuningAPI] Failed to validate configuration:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to validate configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    // Check environment variables
    const requiredEnvVars = [
      'GOOGLE_CLOUD_PROJECT_ID',
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_PRIVATE_KEY'
    ];

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    const hasValidConfig = missingEnvVars.length === 0;

    return NextResponse.json({
      status: 'healthy',
      service: 'Fine-Tuning API',
      timestamp: new Date().toISOString(),
      configuration: {
        hasValidConfig,
        missingEnvVars: missingEnvVars.length > 0 ? missingEnvVars : undefined,
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID ? '✓ Set' : '✗ Missing'
      },
      endpoints: {
        'POST /api/fine-tuning': {
          actions: [
            'start-job - Start a new fine-tuning job',
            'get-status - Get job status by name',
            'list-jobs - List all fine-tuning jobs',
            'cancel-job - Cancel a running job',
            'upload-dataset - Upload training dataset to GCS',
            'validate-config - Validate fine-tuning configuration'
          ]
        }
      },
      documentation: 'https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-supervised-tuning'
    });

  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        service: 'Fine-Tuning API',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 