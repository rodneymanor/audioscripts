'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrainingDataset } from '@/lib/transcription/types';

interface FineTuningJob {
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

interface FineTuningConfig {
  displayName: string;
  baseModel: string;
  bucketName: string;
  fileName: string;
  systemPrompt: string;
  hyperParameters: {
    epochCount: number;
    learningRateMultiplier: number;
  };
  region: string;
}

interface FineTuningSectionProps {
  trainingDataset: TrainingDataset;
  onJobStarted?: (job: FineTuningJob) => void;
}

export default function FineTuningSection({ trainingDataset, onJobStarted }: FineTuningSectionProps) {
  const isMountedRef = useRef(true);
  
  const [config, setConfig] = useState<FineTuningConfig>({
    displayName: `AudioScripts-Model-${new Date().toISOString().split('T')[0]}`,
    baseModel: 'gemini-2.0-flash-001',
    bucketName: 'audioscripts-training-data',
    fileName: `training-dataset-${Date.now()}.jsonl`,
    systemPrompt: `You are an expert short-form video script writer trained on high-performing social media content from successful creators. Your specialty is creating compelling scripts that follow the proven Hook-Bridge-Golden Nugget-WTA structure for maximum engagement and virality.

## Your Framework (Hook-Bridge-Golden Nugget-WTA):

**HOOK** (First 3-5 seconds): Grab attention immediately
- Use pattern interrupts, bold statements, or intriguing questions
- Create curiosity gaps that demand resolution
- Speak directly to the viewer's pain points or desires

**BRIDGE** (Transition): Connect hook to main content
- Acknowledge the hook's premise
- Build credibility and relatability
- Set up the value proposition

**GOLDEN NUGGET** (Core Value): Deliver the main insight
- Provide actionable, specific advice
- Share counterintuitive or surprising information
- Give concrete steps or frameworks
- Make it immediately applicable

**WTA (What To Action)**: Clear next steps
- Tell viewers exactly what to do next
- Create urgency or motivation to act
- Can include follow requests, engagement prompts, or specific actions

## Your Writing Style:
- **Conversational and Direct**: Write like you're talking to a friend
- **Authentic Voice**: Use natural speech patterns, including appropriate emphasis
- **Engagement-Focused**: Every word should serve viewer retention
- **Platform-Optimized**: Designed for TikTok/Instagram short-form content
- **Action-Oriented**: Always drive toward specific outcomes

When given any topic or idea, transform it into a compelling short-form video script that follows the Hook-Bridge-Golden Nugget-WTA structure. Use the language patterns, intensity, and engagement techniques learned from successful creators while maintaining authenticity and providing genuine value.`,
    hyperParameters: {
      epochCount: 3,
      learningRateMultiplier: 1.0
    },
    region: 'us-central1'
  });

  const [jobs, setJobs] = useState<FineTuningJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<FineTuningJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [configValidation, setConfigValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadAvailableModels = useCallback(async () => {
    try {
      console.log('[FineTuning] Loading available models...');
      const response = await fetch('/api/fine-tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-models' })
      });

      const result = await response.json();
      if (result.success && result.data.availableModels) {
        setAvailableModels(result.data.availableModels);
        console.log('[FineTuning] Loaded', result.data.availableModels.length, 'available models');
      } else {
        // Fallback to default models if API doesn't support get-models
        const defaultModels = ['gemini-2.0-flash-001', 'gemini-1.5-pro-002', 'gemini-1.5-flash-002'];
        setAvailableModels(defaultModels);
        console.log('[FineTuning] Using default models:', defaultModels);
      }
    } catch (error) {
      console.error('Failed to load available models:', error);
      // Fallback to default models
      const defaultModels = ['gemini-2.0-flash-001', 'gemini-1.5-pro-002', 'gemini-1.5-flash-002'];
      setAvailableModels(defaultModels);
    }
  }, []);

  const validateConfig = useCallback(async (configToValidate = config) => {
    try {
      console.log('[FineTuning] Validating config...');
      const response = await fetch('/api/fine-tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate-config', config: configToValidate })
      });

      const result = await response.json();
      if (result.success) {
        setConfigValidation(result.data.validation);
        console.log('[FineTuning] Config validation result:', result.data.validation.valid ? 'valid' : 'invalid');
      }
    } catch (error) {
      console.error('Failed to validate config:', error);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    // Prevent multiple simultaneous requests
    if (isLoadingJobs) {
      console.log('[FineTuning] Skipping loadJobs - already loading');
      return;
    }

    setIsLoadingJobs(true);
    try {
      console.log('[FineTuning] Loading jobs...');
      const response = await fetch('/api/fine-tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-jobs', pageSize: 20 })
      });

      const result = await response.json();
      if (result.success) {
        setJobs(result.data.jobs);
        console.log('[FineTuning] Loaded', result.data.jobs.length, 'jobs');
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  }, [isLoadingJobs]);

  // Load available models and validate config on mount only
  useEffect(() => {
    console.log('[FineTuning] Component mounted - loading initial data');
    loadAvailableModels();
    validateConfig(config);
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount

  // Validate config when it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      console.log('[FineTuning] Config changed - validating');
      validateConfig(config);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [config, validateConfig]);

  // Auto-refresh jobs every 30 seconds only if there are active jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some(job => 
      job.state === 'JOB_STATE_PENDING' || 
      job.state === 'JOB_STATE_RUNNING' || 
      job.state === 'JOB_STATE_QUEUED'
    );

    if (!hasActiveJobs) {
      console.log('[FineTuning] No active jobs - skipping auto-refresh');
      return; // Don't start interval if no active jobs
    }

    console.log('[FineTuning] Starting auto-refresh for', jobs.filter(job => 
      job.state === 'JOB_STATE_PENDING' || 
      job.state === 'JOB_STATE_RUNNING' || 
      job.state === 'JOB_STATE_QUEUED'
    ).length, 'active jobs');
    
    const interval = setInterval(() => {
      console.log('[FineTuning] Auto-refreshing jobs...');
      loadJobs();
    }, 30000);

    return () => {
      console.log('[FineTuning] Stopping auto-refresh');
      clearInterval(interval);
    };
  }, [jobs]);

  const uploadDataset = async (): Promise<string> => {
    setIsUploading(true);
    setStatus('Uploading training dataset to Google Cloud Storage...');

    try {
      const response = await fetch('/api/fine-tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload-dataset',
          dataset: trainingDataset,
          bucketName: config.bucketName,
          fileName: config.fileName,
          systemPrompt: config.systemPrompt
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to upload dataset');
      }

      const statusMessage = `Dataset uploaded successfully to ${result.data.datasetUri}`;
      const promptMessage = result.data.systemPromptSaved ? ' (System prompt saved)' : '';
      setStatus(statusMessage + promptMessage);
      return result.data.datasetUri;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Upload failed: ${errorMessage}`);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const startFineTuning = async () => {
    if (!configValidation?.valid) {
      setStatus('Please fix configuration errors before starting');
      return;
    }

    setIsStarting(true);
    setStatus('Starting fine-tuning process...');

    try {
      // First upload the dataset
      const datasetUri = await uploadDataset();

      // Then start the fine-tuning job with full validation
      setStatus('Starting fine-tuning job...');
      const fullConfig = {
        ...config,
        trainingDatasetUri: datasetUri
      };

      const response = await fetch('/api/fine-tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start-job',
          config: fullConfig
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to start fine-tuning job');
      }

      const job = result.data.job;
      setJobs(prev => [job, ...prev]);
      setSelectedJob(job);
      setStatus(`Fine-tuning job started: ${job.displayName}`);
      
      if (onJobStarted) {
        onJobStarted(job);
      }

      // Load all jobs to refresh the list
      loadJobs();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Failed to start fine-tuning: ${errorMessage}`);
    } finally {
      setIsStarting(false);
    }
  };



  const getJobStatus = async (jobName: string) => {
    try {
      const response = await fetch('/api/fine-tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-status', jobName })
      });

      const result = await response.json();
      if (result.success) {
        const updatedJob = result.data.status.job;
        setJobs(prev => prev.map(job => job.name === jobName ? updatedJob : job));
        if (selectedJob?.name === jobName) {
          setSelectedJob(updatedJob);
        }
      }
    } catch (error) {
      console.error('Failed to get job status:', error);
    }
  };

  const cancelJob = async (jobName: string) => {
    try {
      const response = await fetch('/api/fine-tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel-job', jobName })
      });

      const result = await response.json();
      if (result.success) {
        setStatus(`Job cancelled: ${jobName}`);
        loadJobs(); // Refresh the list
      } else {
        setStatus(`Failed to cancel job: ${result.error}`);
      }
    } catch (error) {
      setStatus(`Failed to cancel job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getJobStateDisplay = (state: string): string => {
    switch (state) {
      case 'JOB_STATE_QUEUED': return 'Queued';
      case 'JOB_STATE_PENDING': return 'Pending';
      case 'JOB_STATE_RUNNING': return 'Running';
      case 'JOB_STATE_SUCCEEDED': return 'Completed';
      case 'JOB_STATE_FAILED': return 'Failed';
      case 'JOB_STATE_CANCELLED': return 'Cancelled';
      default: return 'Unknown';
    }
  };

  const getJobStateColor = (state: string): string => {
    switch (state) {
      case 'JOB_STATE_QUEUED':
      case 'JOB_STATE_PENDING':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'JOB_STATE_RUNNING':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'JOB_STATE_SUCCEEDED':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'JOB_STATE_FAILED':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'JOB_STATE_CANCELLED':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-200">
      <h5 className="font-medium text-blue-800 mb-4">🤖 Gemini Fine-Tuning</h5>
      
      {/* Configuration Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Model Configuration */}
          <div className="space-y-3">
            <h6 className="font-medium text-blue-700">Model Configuration</h6>
            
            <div>
              <label className="block text-sm font-medium mb-1">Model Name</label>
              <input
                type="text"
                value={config.displayName}
                onChange={(e) => setConfig(prev => ({ ...prev, displayName: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm"
                placeholder="My Custom Model"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Base Model</label>
              <select
                value={config.baseModel}
                onChange={(e) => setConfig(prev => ({ ...prev, baseModel: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm"
              >
                {availableModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Region</label>
              <select
                value={config.region}
                onChange={(e) => setConfig(prev => ({ ...prev, region: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm"
              >
                <option value="us-central1">us-central1</option>
                <option value="us-east1">us-east1</option>
                <option value="us-west1">us-west1</option>
                <option value="europe-west1">europe-west1</option>
                <option value="asia-southeast1">asia-southeast1</option>
              </select>
            </div>
          </div>

          {/* Storage Configuration */}
          <div className="space-y-3">
            <h6 className="font-medium text-blue-700">Storage Configuration</h6>
            
            <div>
              <label className="block text-sm font-medium mb-1">GCS Bucket Name</label>
              <input
                type="text"
                value={config.bucketName}
                onChange={(e) => setConfig(prev => ({ ...prev, bucketName: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm"
                placeholder="my-training-bucket"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dataset File Name</label>
              <input
                type="text"
                value={config.fileName}
                onChange={(e) => setConfig(prev => ({ ...prev, fileName: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm"
                placeholder="training-dataset.jsonl"
              />
            </div>
          </div>

          {/* System Prompt Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h6 className="font-medium text-blue-700">System Prompt</h6>
              <button
                type="button"
                onClick={() => setConfig(prev => ({ 
                  ...prev, 
                  systemPrompt: `You are an expert short-form video script writer specializing in the Hook-Bridge-Golden Nugget-WTA framework. Transform any topic into compelling 30-60 second scripts that:

HOOK: Grab attention in 3-5 seconds with bold statements or curiosity gaps
BRIDGE: Connect hook to main content, build credibility  
GOLDEN NUGGET: Deliver specific, actionable value
WTA: Clear next steps for the viewer

Write in a conversational, direct style optimized for TikTok/Instagram. Use natural speech patterns and focus on maximum engagement while providing genuine value. Every script should stop scrollers and drive action.`
                }))}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Use Short Version
              </button>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                System Prompt for Fine-Tuned Model
                <span className="text-xs text-gray-500 ml-1">(This will guide how your model responds)</span>
              </label>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm font-mono"
                rows={12}
                placeholder="Enter the system prompt that will guide your fine-tuned model's behavior..."
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">
                  Characters: {config.systemPrompt.length} | Words: {config.systemPrompt.split(/\s+/).filter(w => w.length > 0).length}
                </p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(config.systemPrompt)}
                  className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Hyperparameters */}
        <div>
          <h6 className="font-medium text-blue-700 mb-3">Hyperparameters</h6>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Epochs</label>
              <input
                type="number"
                min="1"
                max="20"
                value={config.hyperParameters.epochCount}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  hyperParameters: { ...prev.hyperParameters, epochCount: parseInt(e.target.value) || 3 }
                }))}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Learning Rate Multiplier</label>
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={config.hyperParameters.learningRateMultiplier}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  hyperParameters: { ...prev.hyperParameters, learningRateMultiplier: parseFloat(e.target.value) || 1.0 }
                }))}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>


          </div>
        </div>

        {/* Validation Results */}
        {configValidation && (
          <div className={`p-3 rounded border text-sm ${
            configValidation.valid 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <p className="font-medium">
              Configuration: {configValidation.valid ? '✅ Valid' : '❌ Invalid'}
            </p>
            {configValidation.errors.length > 0 && (
              <ul className="mt-1 list-disc list-inside text-xs">
                {configValidation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Dataset Info */}
        <div className="p-3 bg-white rounded border text-sm">
          <p className="font-medium mb-1">Training Dataset Ready</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <span>Total: {trainingDataset.examples.length} examples</span>
            <span>Original: {trainingDataset.metadata?.originalExamples || 0}</span>
            <span>Synthetic: {trainingDataset.metadata?.syntheticExamples || 0}</span>
            <span>Topics: {trainingDataset.summary.topics.length}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={startFineTuning}
            disabled={isStarting || isUploading || !configValidation?.valid}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStarting ? 'Starting...' : isUploading ? 'Uploading...' : 'Start Fine-Tuning'}
          </button>
          
          <button
            onClick={loadJobs}
            disabled={isLoadingJobs}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {isLoadingJobs ? 'Loading...' : 'Refresh Jobs'}
          </button>
        </div>

        {/* Status */}
        {status && (
          <div className="p-3 bg-white rounded border text-sm">
            <p className={status.includes('failed') || status.includes('Failed') ? 'text-red-600' : 'text-blue-600'}>
              {status}
            </p>
          </div>
        )}
      </div>

      {/* Jobs List */}
      {jobs.length > 0 && (
        <div className="mt-6">
          <h6 className="font-medium text-blue-700 mb-3">Fine-Tuning Jobs</h6>
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.name}
                className={`p-3 rounded border cursor-pointer transition-colors ${
                  selectedJob?.name === job.name 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
                onClick={() => setSelectedJob(job)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h6 className="font-medium text-sm">{job.displayName}</h6>
                      <span className={`px-2 py-1 rounded text-xs border ${getJobStateColor(job.state)}`}>
                        {getJobStateDisplay(job.state)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Created: {new Date(job.createTime).toLocaleString()}
                    </p>
                    {job.trainingProgress !== undefined && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Progress</span>
                          <span>{job.trainingProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${job.trainingProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        getJobStatus(job.name);
                      }}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 transition-colors"
                    >
                      Refresh
                    </button>
                    {(job.state === 'JOB_STATE_RUNNING' || job.state === 'JOB_STATE_PENDING') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelJob(job.name);
                        }}
                        className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Job Details */}
      {selectedJob && (
        <div className="mt-4 p-3 bg-white rounded border">
          <h6 className="font-medium text-sm mb-2">Job Details: {selectedJob.displayName}</h6>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <p><strong>Name:</strong> {selectedJob.name}</p>
              <p><strong>State:</strong> {getJobStateDisplay(selectedJob.state)}</p>
              <p><strong>Created:</strong> {new Date(selectedJob.createTime).toLocaleString()}</p>
            </div>
            <div>
              {selectedJob.startTime && (
                <p><strong>Started:</strong> {new Date(selectedJob.startTime).toLocaleString()}</p>
              )}
              {selectedJob.endTime && (
                <p><strong>Ended:</strong> {new Date(selectedJob.endTime).toLocaleString()}</p>
              )}
              {selectedJob.modelDisplayName && (
                <p><strong>Model:</strong> {selectedJob.modelDisplayName}</p>
              )}
            </div>
          </div>
          {selectedJob.error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <strong>Error:</strong> {JSON.stringify(selectedJob.error)}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 