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
import { 
  Loader2, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  FileText, 
  Zap, 
  Sparkles,
  Copy,
  ExternalLink,
  Folder,
  Video,
  MessageSquare,
  FileDown,
  Database,
  XCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

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

interface PipelineStep {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message: string;
  details?: any;
  timestamp: string;
}

interface AutomatedPipelineProps {
  onComplete?: (result: any) => void;
}

export function AutomatedPipeline({ onComplete }: AutomatedPipelineProps) {
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [videoCount, setVideoCount] = useState(40);
  const [fastMode, setFastMode] = useState(false);
  const [generateSyntheticData, setGenerateSyntheticData] = useState(true);
  const [syntheticScriptCount, setSyntheticScriptCount] = useState(10);
  const [exportFormat, setExportFormat] = useState<'jsonl' | 'json'>('jsonl');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();

  const getStepIcon = (status: PipelineStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Play className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStepColor = (status: PipelineStep['status']) => {
    switch (status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      case 'running':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "Text has been copied to your clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy text to clipboard",
        variant: "destructive",
      });
    }
  };

  const renderStepDetails = (step: PipelineStep) => {
    if (!step.details) return null;

    switch (step.step) {
      case 'video_extraction':
        if (step.details.videoUrls) {
          return (
            <div className="mt-3 space-y-2">
              <h4 className="font-medium text-sm">Extracted Video URLs:</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {step.details.videoUrls.map((video: any) => (
                  <div key={video.index} className="flex items-center gap-2 text-xs bg-white p-2 rounded border">
                    <Video className="h-3 w-3" />
                    <span className="font-mono">#{video.index}</span>
                    <span className="text-gray-600">{video.platform}</span>
                    <span className="text-gray-500">({video.viewCount} views)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 ml-auto"
                      onClick={() => copyToClipboard(video.url)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        break;

      case 'drive_storage':
        if (step.details.folderName) {
          return (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{step.details.folderName}</span>
                {step.details.folderUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => window.open(step.details.folderUrl, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {step.details.files && step.details.files.length > 0 && (
                <div className="text-xs text-gray-600">
                  Files: {step.details.files.map((file: any) => file.name).join(', ')}
                </div>
              )}
            </div>
          );
        }
        break;

      case 'video_processing':
        if (step.details.successful) {
          return (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-green-600">
                  Success Rate: {step.details.successRate}
                </Badge>
                <Badge variant="outline">
                  Processing Time: {step.details.processingTime}
                </Badge>
              </div>
              
              {step.details.successful.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Successful Transcriptions:</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {step.details.successful.map((result: any, index: number) => (
                      <div key={index} className="bg-white p-3 rounded border">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-green-500" />
                          <span className="font-mono text-sm">{result.videoId}</span>
                          <Badge variant="secondary" className="text-xs">{result.platform}</Badge>
                          <span className="text-xs text-gray-500">{result.processingTime}</span>
                        </div>
                        <div className="text-xs text-gray-700 mb-2">
                          <strong>Transcription:</strong> {result.transcription}
                        </div>
                        {result.marketingSegments && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <strong>Hook:</strong> {result.marketingSegments.Hook?.substring(0, 50)}...
                            </div>
                            <div>
                              <strong>Bridge:</strong> {result.marketingSegments.Bridge?.substring(0, 50)}...
                            </div>
                            <div>
                              <strong>Nugget:</strong> {result.marketingSegments.GoldenNugget?.substring(0, 50)}...
                            </div>
                            <div>
                              <strong>CTA:</strong> {result.marketingSegments.WTA?.substring(0, 50)}...
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step.details.failed && step.details.failed.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-red-600">Failed Downloads:</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {step.details.failed.map((failure: any, index: number) => (
                      <div key={index} className="bg-red-50 p-2 rounded border border-red-200 text-xs">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-3 w-3 text-red-500" />
                          <span className="font-mono">{failure.videoId}</span>
                          <span className="text-red-600">{failure.error}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }
        break;

      case 'template_generation':
        if (step.details.templates) {
          return (
            <div className="mt-3 space-y-2">
              <h4 className="font-medium text-sm">Generated Templates:</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {step.details.templates.map((template: any) => (
                  <div key={template.index} className="bg-white p-2 rounded border text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div><strong>Hook:</strong> {template.hook}</div>
                      <div><strong>Bridge:</strong> {template.bridge}</div>
                      <div><strong>Nugget:</strong> {template.nugget}</div>
                      <div><strong>CTA:</strong> {template.wta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        break;

      case 'synthetic_generation':
        if (step.details.details) {
          return (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="font-medium text-sm">
                  Generated {step.details.successfulSynthetic}/{step.details.totalAttempted} synthetic scripts
                </span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {step.details.details.map((detail: any, index: number) => (
                  <div key={index} className={`p-2 rounded border text-xs ${
                    detail.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {detail.status === 'success' ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span className="font-medium">{detail.topic}</span>
                    </div>
                    {detail.hook && (
                      <div className="mt-1 text-gray-700">
                        <strong>Hook:</strong> {detail.hook}
                      </div>
                    )}
                    {detail.error && (
                      <div className="mt-1 text-red-600">
                        <strong>Error:</strong> {detail.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        break;

      case 'data_export':
        if (step.details.totalExamples) {
          return (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-blue-600">
                  {step.details.totalExamples} Training Examples
                </Badge>
                <Badge variant="outline">
                  Format: {step.details.format.toUpperCase()}
                </Badge>
              </div>
              {step.details.downloadUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(step.details.downloadUrl, '_blank')}
                  className="mt-2"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Training Data
                </Button>
              )}
              {step.details.summary && (
                <div className="text-xs text-gray-600 mt-2">
                  <div>Original Scripts: {step.details.summary.originalScripts || 0}</div>
                  <div>Synthetic Scripts: {step.details.summary.syntheticScripts || 0}</div>
                  <div>Total Examples: {step.details.summary.totalExamples || 0}</div>
                </div>
              )}
            </div>
          );
        }
        break;
    }

    return null;
  };

  const startPipeline = async () => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to process",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setSteps([]);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/automated-pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          platform,
          videoCount,
          options: {
            fastMode,
            generateSyntheticData,
            syntheticScriptCount,
            exportFormat,
            includeMetadata: true
          }
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSteps(data.steps || []);
        setResult(data.data);
        toast({
          title: "Pipeline completed!",
          description: data.message,
        });
        onComplete?.(data);
      } else {
        setSteps(data.steps || []);
        setError(data.error);
        toast({
          title: "Pipeline failed",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Pipeline error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      toast({
        title: "Pipeline error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getOverallProgress = () => {
    if (steps.length === 0) return 0;
    const completed = steps.filter(step => step.status === 'completed').length;
    return Math.round((completed / steps.length) * 100);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Automated Content Pipeline
          </CardTitle>
          <CardDescription>
            Transform social media profiles into fine-tuning datasets with a single click
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter TikTok or Instagram username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={platform} onValueChange={(value: 'tiktok' | 'instagram') => setPlatform(value)} disabled={isProcessing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoCount">Video Count</Label>
              <Select value={videoCount.toString()} onValueChange={(value) => setVideoCount(parseInt(value))} disabled={isProcessing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 videos</SelectItem>
                  <SelectItem value="40">40 videos (recommended)</SelectItem>
                  <SelectItem value="60">60 videos</SelectItem>
                  <SelectItem value="80">80 videos</SelectItem>
                  <SelectItem value="100">100 videos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exportFormat">Export Format</Label>
              <Select value={exportFormat} onValueChange={(value: 'jsonl' | 'json') => setExportFormat(value)} disabled={isProcessing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jsonl">JSONL (OpenAI Fine-tuning)</SelectItem>
                  <SelectItem value="json">JSON (General Purpose)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="fastMode">Fast Mode</Label>
                <p className="text-sm text-gray-600">
                  {fastMode ? 'Quick transcription only (5-10 min)' : 'Full marketing analysis (25-30 min)'}
                </p>
              </div>
              <Switch
                id="fastMode"
                checked={fastMode}
                onCheckedChange={setFastMode}
                disabled={isProcessing}
              />
            </div>

            {!fastMode && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="generateSyntheticData">Generate Synthetic Data</Label>
                    <p className="text-sm text-gray-600">
                      Create AI-generated training scripts for better fine-tuning results
                    </p>
                  </div>
                  <Switch
                    id="generateSyntheticData"
                    checked={generateSyntheticData}
                    onCheckedChange={setGenerateSyntheticData}
                    disabled={isProcessing}
                  />
                </div>

                {generateSyntheticData && (
                  <div className="space-y-2">
                    <Label htmlFor="syntheticScriptCount">Synthetic Script Count</Label>
                    <Select 
                      value={syntheticScriptCount.toString()} 
                      onValueChange={(value) => setSyntheticScriptCount(parseInt(value))} 
                      disabled={isProcessing}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 scripts</SelectItem>
                        <SelectItem value="10">10 scripts (recommended)</SelectItem>
                        <SelectItem value="15">15 scripts</SelectItem>
                        <SelectItem value="20">20 scripts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>

          <Button 
            onClick={startPipeline} 
            disabled={isProcessing || !username.trim()}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Pipeline...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Automated Pipeline
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Progress Display */}
      {(isProcessing || steps.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Pipeline Progress</span>
              {isProcessing && (
                <Badge variant="outline" className="animate-pulse">
                  Processing...
                </Badge>
              )}
            </CardTitle>
            {steps.length > 0 && (
              <div className="space-y-2">
                <Progress value={getOverallProgress()} className="w-full" />
                <p className="text-sm text-gray-600">
                  {getOverallProgress()}% complete ({steps.filter(s => s.status === 'completed').length} of {steps.length} steps)
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className={`border rounded-lg p-4 ${getStepColor(step.status)}`}>
                  <div className="flex items-start gap-3">
                    {getStepIcon(step.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm">{step.message}</h3>
                        <span className="text-xs text-gray-500">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {renderStepDetails(step)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              Pipeline Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Pipeline Completed Successfully
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Video className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-700">{result.transcription?.successful || 0}</div>
                <div className="text-sm text-blue-600">Videos Processed</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <FileText className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-700">{result.templates?.generated || 0}</div>
                <div className="text-sm text-green-600">Templates Generated</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Sparkles className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-700">{result.synthetic?.generated || 0}</div>
                <div className="text-sm text-purple-600">Synthetic Scripts</div>
              </div>
              
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <Database className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <div className="text-2xl font-bold text-orange-700">{result.trainingData?.totalExamples || 0}</div>
                <div className="text-sm text-orange-600">Training Examples</div>
              </div>
            </div>

            {result.trainingData?.downloadUrl && (
              <div className="mt-6 pt-4 border-t">
                <Button
                  onClick={() => window.open(result.trainingData.downloadUrl, '_blank')}
                  className="w-full"
                  size="lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Training Dataset ({result.trainingData.format.toUpperCase()})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 