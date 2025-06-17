"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play, CheckCircle2, AlertCircle, Download, FileText, Zap, Sparkles } from "lucide-react";

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

interface PipelineResult {
  success: boolean;
  data?: {
    pipeline: {
      username: string;
      platform: string;
      videoCount: number;
      processingMode: string;
      completedAt: string;
    };
    extraction: {
      totalVideos: number;
      googleDrive?: any;
    };
    transcription: {
      totalProcessed: number;
      successful: number;
      failed: number;
      processingTime: number;
      googleDrive?: any;
    };
    templates: {
      generated: number;
      templates: any[];
    };
    synthetic: {
      generated: number;
      scripts: any[];
    };
    trainingData: {
      format: string;
      totalExamples: number;
      summary?: any;
      downloadUrl?: string;
      metadata?: any;
    };
  };
  message?: string;
  error?: string;
}

export default function AutomatedPipeline() {
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [videoCount, setVideoCount] = useState(40);
  const [fastMode, setFastMode] = useState(false);
  const [generateSyntheticData, setGenerateSyntheticData] = useState(true);
  const [syntheticScriptCount, setSyntheticScriptCount] = useState(10);
  const [exportFormat, setExportFormat] = useState<'jsonl' | 'json'>('jsonl');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleRunPipeline = async () => {
    if (!username.trim()) {
      setStatusMessage("Please enter a username");
      return;
    }

    setIsRunning(true);
    setResult(null);
    setProgress(0);
    setCurrentStage("Initializing pipeline...");
    setStatusMessage("");

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const requestBody: AutomatedPipelineRequest = {
        username: username.trim().replace('@', ''),
        platform: platform as 'tiktok' | 'instagram',
        videoCount,
        options: {
          fastMode,
          generateSyntheticData,
          syntheticScriptCount,
          exportFormat,
          includeMetadata
        }
      };

      console.log('[AutomatedPipeline] Starting pipeline with config:', requestBody);

      // Simulate progress updates (since we don't have real-time progress from the API)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 90) return prev + 2;
          return prev;
        });
      }, 2000);

      // Update stage messages periodically
      const stageMessages = [
        "Extracting top-performing videos...",
        "Downloading and analyzing content...",
        "Generating marketing templates...",
        "Creating synthetic training data...",
        "Preparing fine-tuning dataset..."
      ];

      let stageIndex = 0;
      const stageInterval = setInterval(() => {
        if (stageIndex < stageMessages.length) {
          setCurrentStage(stageMessages[stageIndex]);
          stageIndex++;
        }
      }, 15000); // Update stage every 15 seconds

      const response = await fetch("/api/automated-pipeline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      clearInterval(progressInterval);
      clearInterval(stageInterval);

      const pipelineResult: PipelineResult = await response.json();

      if (!response.ok) {
        throw new Error(pipelineResult.error || `HTTP error! status: ${response.status}`);
      }

      setProgress(100);
      setCurrentStage("Pipeline completed successfully!");
      setResult(pipelineResult);
      setStatusMessage(pipelineResult.message || "Pipeline completed successfully");

      console.log('[AutomatedPipeline] Pipeline completed:', pipelineResult);

    } catch (error) {
      console.error('[AutomatedPipeline] Pipeline failed:', error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        setStatusMessage("Pipeline cancelled by user");
        setCurrentStage("Cancelled");
      } else {
        setStatusMessage(error instanceof Error ? error.message : "Pipeline failed with unknown error");
        setCurrentStage("Error occurred");
      }
      setProgress(0);
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleDownloadTrainingData = () => {
    if (result?.data?.trainingData?.downloadUrl) {
      window.open(result.data.trainingData.downloadUrl, '_blank');
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const getStatusIcon = () => {
    if (isRunning) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (result?.success) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (statusMessage && !result?.success) return <AlertCircle className="h-4 w-4 text-red-500" />;
    return <Play className="h-4 w-4" />;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Automated Fine-Tuning Pipeline
        </h1>
        <p className="text-gray-600">
          Complete end-to-end automation: Extract → Analyze → Generate → Export for Fine-Tuning
        </p>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <h2 className="text-xl font-semibold mb-4">Pipeline Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Basic Settings */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Creator Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username (without @)"
                disabled={isRunning}
              />
            </div>

            <div>
              <Label htmlFor="platform">Platform</Label>
              <Select value={platform} onValueChange={setPlatform} disabled={isRunning}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="videoCount">Video Count</Label>
              <Select 
                value={videoCount.toString()} 
                onValueChange={(value) => setVideoCount(parseInt(value))}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 videos</SelectItem>
                  <SelectItem value="40">40 videos (recommended)</SelectItem>
                  <SelectItem value="60">60 videos</SelectItem>
                  <SelectItem value="100">100 videos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Processing Mode</Label>
                <p className="text-sm text-gray-500">
                  {fastMode ? "Fast transcription only" : "Full marketing analysis"}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <Switch
                  checked={fastMode}
                  onCheckedChange={setFastMode}
                  disabled={isRunning}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Generate Synthetic Data</Label>
                <p className="text-sm text-gray-500">
                  Create additional training examples
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <Switch
                  checked={generateSyntheticData}
                  onCheckedChange={setGenerateSyntheticData}
                  disabled={isRunning || fastMode}
                />
              </div>
            </div>

            {generateSyntheticData && !fastMode && (
              <div>
                <Label htmlFor="syntheticCount">Synthetic Scripts</Label>
                <Select 
                  value={syntheticScriptCount.toString()} 
                  onValueChange={(value) => setSyntheticScriptCount(parseInt(value))}
                  disabled={isRunning}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 scripts</SelectItem>
                    <SelectItem value="10">10 scripts</SelectItem>
                    <SelectItem value="15">15 scripts</SelectItem>
                    <SelectItem value="20">20 scripts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="exportFormat">Export Format</Label>
              <Select 
                value={exportFormat} 
                onValueChange={(value: 'jsonl' | 'json') => setExportFormat(value)}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jsonl">JSONL (Gemini Fine-tuning)</SelectItem>
                  <SelectItem value="json">JSON (General Purpose)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleRunPipeline}
            disabled={isRunning || !username.trim()}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            size="lg"
          >
            {getStatusIcon()}
            {isRunning ? "Running Pipeline..." : "Start Automated Pipeline"}
          </Button>
          
          {isRunning && (
            <Button
              onClick={handleCancel}
              variant="outline"
              size="lg"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Progress Display */}
      {isRunning && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pipeline Progress</h3>
              <span className="text-sm text-gray-500">{progress}%</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {currentStage}
            </p>
          </div>
        </div>
      )}

      {/* Status Message */}
      {statusMessage && (
        <div className={`rounded-lg border p-4 ${
          result?.success 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {result?.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
            <p className="font-medium">{statusMessage}</p>
          </div>
        </div>
      )}

      {/* Results Display */}
      {result?.success && result.data && (
        <div className="bg-white rounded-lg border shadow-sm p-6 space-y-6">
          <h3 className="text-xl font-semibold">Pipeline Results</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Extraction Results */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-900">Videos Extracted</h4>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {result.data.extraction.totalVideos}
              </p>
              <p className="text-sm text-blue-600">
                From {result.data.pipeline.platform}: @{result.data.pipeline.username}
              </p>
            </div>

            {/* Transcription Results */}
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold text-green-900">Videos Analyzed</h4>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {result.data.transcription.successful}
              </p>
              <p className="text-sm text-green-600">
                Processed in {formatDuration(result.data.transcription.processingTime)}
              </p>
            </div>

            {/* Template Results */}
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-purple-900">Templates</h4>
              </div>
              <p className="text-2xl font-bold text-purple-700">
                {result.data.templates.generated}
              </p>
              <p className="text-sm text-purple-600">
                Marketing templates generated
              </p>
            </div>

            {/* Training Data Results */}
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Download className="h-5 w-5 text-orange-600" />
                <h4 className="font-semibold text-orange-900">Training Examples</h4>
              </div>
              <p className="text-2xl font-bold text-orange-700">
                {result.data.trainingData.totalExamples}
              </p>
              <p className="text-sm text-orange-600">
                Ready for fine-tuning ({result.data.trainingData.format.toUpperCase()})
              </p>
            </div>
          </div>

          {/* Synthetic Data Results */}
          {result.data.synthetic.generated > 0 && (
            <div className="bg-pink-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-pink-600" />
                <h4 className="font-semibold text-pink-900">Synthetic Scripts Generated</h4>
              </div>
              <p className="text-2xl font-bold text-pink-700">
                {result.data.synthetic.generated}
              </p>
              <p className="text-sm text-pink-600">
                Additional training examples created
              </p>
            </div>
          )}

          {/* Download Button */}
          {result.data.trainingData.downloadUrl && (
            <div className="pt-4 border-t">
              <Button
                onClick={handleDownloadTrainingData}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                size="lg"
              >
                <Download className="h-5 w-5 mr-2" />
                Download Training Dataset ({result.data.trainingData.format.toUpperCase()})
              </Button>
            </div>
          )}

          {/* Pipeline Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Pipeline Summary</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Processing Mode:</strong> {result.data.pipeline.processingMode}</p>
              <p><strong>Completed:</strong> {new Date(result.data.pipeline.completedAt).toLocaleString()}</p>
              <p><strong>Success Rate:</strong> {Math.round((result.data.transcription.successful / result.data.transcription.totalProcessed) * 100)}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 