import { Storage } from '@google-cloud/storage';
import { TrainingDataset } from './types';
import { v1 as aiplatform } from '@google-cloud/aiplatform';

export interface FineTuningJobConfig {
  displayName: string;
  baseModel: string;
  trainingDatasetUri: string;
  validationDatasetUri?: string;
  systemPrompt?: string;
  hyperParameters?: {
    epochCount?: number;
    learningRateMultiplier?: number;
    adapterSize?: number;
  };
  region?: string;
}

export interface FineTuningJob {
  name: string;
  displayName: string;
  state: string;
  createTime: string;
  updateTime: string;
  startTime?: string;
  endTime?: string;
  error?: any;
  modelDisplayName?: string;
  trainingProgress?: number;
  validationLoss?: number;
  trainingLoss?: number;
}

export interface FineTuningJobStatus {
  job: FineTuningJob;
  logs?: string[];
  metrics?: {
    trainingLoss: number[];
    validationLoss: number[];
    epochs: number[];
  };
}

export class FineTuningService {
  private client: aiplatform.JobServiceClient;
  private storageClient: Storage;
  private readonly projectId: string;
  private readonly location: string;

  constructor(projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '',
              location = 'us-central1') {
    if (!projectId) {
      throw new Error(
        'GOOGLE_CLOUD_PROJECT_ID must be provided via arg or env var'
      );
    }
    this.projectId = projectId;
    this.location = location;

    const credentials = this.getServiceAccountCredentials();
    
    // Separate configurations for different services
    const storageOptions = credentials
      ? { projectId, credentials }
      : { projectId };
    
    const aiPlatformOptions = credentials
      ? { projectId, credentials, apiEndpoint: `${location}-aiplatform.googleapis.com` }
      : { projectId, apiEndpoint: `${location}-aiplatform.googleapis.com` };

    this.client = new aiplatform.JobServiceClient(aiPlatformOptions);
    this.storageClient = new Storage(storageOptions);
  }

  /* ---------- helpers ---------- */

  private getServiceAccountCredentials() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    return email && privateKey
      ? {
          type: 'service_account',
          client_email: email,
          private_key: privateKey.replace(/\\n/g, '\n')
        }
      : undefined;
  }

  private async getAccessToken(): Promise<string> {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      credentials: this.getServiceAccountCredentials()
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    return accessToken.token || '';
  }



  /* ---------- public API ---------- */

  /** Upload a JSONL training file (and optional system-prompt file) */
  async uploadTrainingDataset(
    dataset: TrainingDataset,
    bucketName: string,
    fileName = 'training-dataset.jsonl',
    systemPrompt?: string
  ): Promise<string> {
    console.log(`[FineTuningService] Uploading to bucket: ${bucketName}`);

    // Create JSONL content in the correct Vertex AI format
    const jsonlContent = dataset.examples
      .map(example => JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: example.input }]
          },
          {
            role: "model", 
            parts: [{ text: example.output }]
          }
        ]
      }))
      .join('\n');

    // Upload the JSONL file
    const bucket = this.storageClient.bucket(bucketName);
    const file = bucket.file(fileName);
    
    await file.save(jsonlContent, {
      metadata: {
        contentType: 'application/jsonl'
      }
    });

    console.log(`[FineTuningService] Uploaded training dataset: ${fileName}`);

    // Upload system prompt if provided
    if (systemPrompt) {
      const promptFileName = fileName.replace(/\.jsonl$/, '-system-prompt.txt');
      const promptFile = bucket.file(promptFileName);
      
      await promptFile.save(systemPrompt, {
        metadata: {
          contentType: 'text/plain'
        }
      });
      
      console.log(`[FineTuningService] Uploaded system prompt: ${promptFileName}`);
    }

    return `gs://${bucketName}/${fileName}`;
  }

  /** Kick off a tuning job that fine-tunes Gemini */
  async startFineTuningJob(
    cfg: FineTuningJobConfig
  ): Promise<FineTuningJob> {
    const location = cfg.region ?? this.location;
    
    // Create tuning job using the correct Vertex AI tuning API
    const tuningJob = {
      baseModel: cfg.baseModel,
      supervisedTuningSpec: {
        trainingDatasetUri: cfg.trainingDatasetUri,
        ...(cfg.validationDatasetUri && { validationDatasetUri: cfg.validationDatasetUri }),
        ...(cfg.hyperParameters && {
          hyperParameters: {
            ...(cfg.hyperParameters.epochCount && { epochCount: cfg.hyperParameters.epochCount }),
            ...(cfg.hyperParameters.learningRateMultiplier && { learningRateMultiplier: cfg.hyperParameters.learningRateMultiplier })
            // Note: adapterSize is not supported for gemini-2.0-flash-001
          }
        })
      },
      ...(cfg.displayName && { tunedModelDisplayName: cfg.displayName })
    };

    console.log('[FineTuningService] Creating tuning job with config:', JSON.stringify(tuningJob, null, 2));

    // Use the tuningJobs.create REST API endpoint
    const response = await fetch(`https://${location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${location}/tuningJobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tuningJob)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FineTuningService] Tuning job creation failed:', errorText);
      throw new Error(`Failed to create tuning job: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[FineTuningService] Tuning job created successfully:', result.name);

    const now = new Date().toISOString();
    return {
      name: result.name ?? '',
      displayName: cfg.displayName,
      state: result.state ?? 'JOB_STATE_PENDING',
      createTime: result.createTime ?? now,
      updateTime: result.updateTime ?? now,
      modelDisplayName: cfg.displayName
    };
  }

  /** Fetch live status of a job */
  async getJobStatus(jobName: string): Promise<FineTuningJobStatus> {
    // Use the tuningJobs.get REST API endpoint
    const response = await fetch(`https://${this.location}-aiplatform.googleapis.com/v1/${jobName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get tuning job status: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const job = await response.json();

    const toIso = (ts: any) => {
      if (!ts?.seconds) return undefined;
      const seconds = typeof ts.seconds === 'string' ? parseInt(ts.seconds) : Number(ts.seconds);
      return new Date(seconds * 1e3).toISOString();
    };

    const fineJob: FineTuningJob = {
      name: job.name ?? '',
      displayName: job.tunedModelDisplayName ?? job.displayName ?? '',
      state: String(job.state ?? 'JOB_STATE_PENDING'),
      createTime: toIso(job.createTime) ?? new Date().toISOString(),
      updateTime: toIso(job.updateTime) ?? new Date().toISOString(),
      startTime: toIso(job.startTime),
      endTime: toIso(job.endTime),
      error: job.error,
      modelDisplayName: job.tunedModelDisplayName ?? undefined,
      trainingProgress: this.calculateProgress(String(job.state ?? 'JOB_STATE_PENDING'))
    };

    return { job: fineJob };
  }

  async listJobs(pageSize = 10): Promise<FineTuningJob[]> {
    // Use the tuningJobs.list REST API endpoint
    const response = await fetch(`https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/tuningJobs?pageSize=${pageSize}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list tuning jobs: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    const jobs = result.tuningJobs || [];

    return jobs.map((j: any) => ({
      name: j.name ?? '',
      displayName: j.tunedModelDisplayName ?? j.displayName ?? '',
      state: String(j.state ?? 'JOB_STATE_PENDING'),
      createTime: j.createTime ? new Date(j.createTime).toISOString() : new Date().toISOString(),
      updateTime: j.updateTime ? new Date(j.updateTime).toISOString() : new Date().toISOString(),
      startTime: j.startTime ? new Date(j.startTime).toISOString() : undefined,
      endTime: j.endTime ? new Date(j.endTime).toISOString() : undefined,
      error: j.error,
      modelDisplayName: j.tunedModelDisplayName ?? undefined,
      trainingProgress: this.calculateProgress(String(j.state ?? 'JOB_STATE_PENDING'))
    }));
  }

  async cancelJob(jobName: string): Promise<void> {
    // Use the tuningJobs.cancel REST API endpoint
    const response = await fetch(`https://${this.location}-aiplatform.googleapis.com/v1/${jobName}:cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to cancel tuning job: ${response.status} ${response.statusText} - ${errorText}`);
    }
  }

  /* ---------- utilities ---------- */

  getAvailableBaseModels(): string[] {
    return ['gemini-2.0-flash-001', 'gemini-2.5-flash-001', 'gemini-2.5-pro-001'];
  }

  validateConfig(cfg: FineTuningJobConfig, skipDatasetUri = false): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!cfg.displayName?.trim()) errors.push('Display name is required');
    if (!this.getAvailableBaseModels().includes(cfg.baseModel))
      errors.push('Unsupported base model');

    if (!skipDatasetUri && !/^gs:\/\//.test(cfg.trainingDatasetUri))
      errors.push('trainingDatasetUri must be a gs:// path');

    const hp = cfg.hyperParameters;
    if (hp?.epochCount && (hp.epochCount < 1 || hp.epochCount > 20))
      errors.push('epochCount must be 1-20');
    if (hp?.learningRateMultiplier &&
        (hp.learningRateMultiplier < 0.1 || hp.learningRateMultiplier > 10))
      errors.push('learningRateMultiplier must be 0.1-10');
    if (hp?.adapterSize)
      errors.push('adapterSize is not supported for gemini-2.0-flash-001');

    return { valid: errors.length === 0, errors };
  }

  // Add the validateConfigForUI method that the API route expects
  validateConfigForUI(config: Omit<FineTuningJobConfig, 'trainingDatasetUri'>): { valid: boolean; errors: string[] } {
    const configWithDummyUri = {
      ...config,
      trainingDatasetUri: 'gs://dummy/dummy.jsonl' // Dummy URI for validation
    };
    return this.validateConfig(configWithDummyUri, true);
  }

  private calculateProgress(state: string): number {
    switch (state) {
      case 'JOB_STATE_QUEUED':   return 0;
      case 'JOB_STATE_PENDING':  return 5;
      case 'JOB_STATE_RUNNING':  return 50;
      case 'JOB_STATE_SUCCEEDED':return 100;
      default:                   return 0;
    }
  }
}
