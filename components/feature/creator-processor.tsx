"use client";

import { useState, useRef, useEffect } from "react";
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
import { Loader2, AlertCircle, CheckCircle2, FileText, Download, Zap } from "lucide-react";
import FineTuningSection from './fine-tuning-section';

// Rate limiting: Track API calls
const rateLimiter = {
  calls: [] as number[],
  maxCalls: 5, // Max 5 calls per minute
  timeWindow: 60000, // 1 minute in milliseconds
  
  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove calls older than time window
    this.calls = this.calls.filter(time => now - time < this.timeWindow);
    return this.calls.length < this.maxCalls;
  },
  
  recordCall(): void {
    this.calls.push(Date.now());
  },
  
  getWaitTime(): number {
    if (this.calls.length === 0) return 0;
    const oldestCall = Math.min(...this.calls);
    return Math.max(0, this.timeWindow - (Date.now() - oldestCall));
  }
};

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  rateLimited?: boolean;
  platform?: string;
  username?: string;
  pagination?: {
    hasMore: boolean;
    maxId?: string;
    totalRequested?: number;
    totalExtracted?: number;
  };
  extractedVideos?: Array<{
    id: string;
    video_url?: string;
    thumbnail?: string;
    is_video: boolean;
    platform: string;
    fileSize?: number;
    quality?: string;
    viewCount?: number;
    likeCount?: number;
  }>;
  googleDrive?: {
    folderId: string;
    folderName: string;
    metadataFileId?: string;
    folderUrl: string;
  };
}

interface WordAssignment {
  word: string;
  category: 'Hook' | 'Bridge' | 'Golden Nugget' | 'WTA';
  position: number;
}

interface MarketingSegments {
  Hook: string;
  Bridge: string;
  "Golden Nugget": string;
  WTA: string;
}

interface ScriptTemplate {
  hook: string;
  bridge: string;
  nugget: string;
  wta: string;
}

interface GeneratedTemplates {
  allTemplates?: ScriptTemplate[];
  syntheticScripts?: Array<{
    topic: string;
    script: MarketingSegments;
    processingTime: number;
  }>;
  // For backward compatibility
  hook?: string;
  bridge?: string;
  nugget?: string;
  wta?: string;
}

interface TranscriptionResponse {
  success: boolean;
  data?: {
    transcriptionResults: Array<{
      videoId: string;
      videoUrl: string;
      platform: string;
      transcription: string;
      marketingSegments?: MarketingSegments;
      wordAssignments?: WordAssignment[];
      processingTime: number;
      success: boolean;
      error?: string;
    }>;
    summary: {
      totalVideos: number;
      successful: number;
      failed: number;
      processingTime: number;
    };
    googleDrive?: {
      folderName: string;
      folderUrl: string;
      files: Array<{ name: string; url: string }>;
    };
  };
  error?: string;
}

export default function CreatorProcessor() {
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [videoCount, setVideoCount] = useState(40);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResponse, setTranscriptionResponse] = useState<TranscriptionResponse | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState("");
  const [fastMode, setFastMode] = useState(false); // Default to marketing analysis mode for fine-tuning
  const abortControllerRef = useRef<AbortController | null>(null);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  
  // Template generation state
  const [templateGenerationStatus, setTemplateGenerationStatus] = useState("");
  const [generatedTemplates, setGeneratedTemplates] = useState<GeneratedTemplates | null>(null);
  const [syntheticTopic, setSyntheticTopic] = useState("");
  const [syntheticScript, setSyntheticScript] = useState<MarketingSegments | null>(null);
  
  // Training data export state
  const [exportStatus, setExportStatus] = useState("");
  const [trainingDataset, setTrainingDataset] = useState<any>(null);
  const [exportOptions, setExportOptions] = useState({
    includeOriginal: true,
    includeSynthetic: true,
    maxExamplesPerVideo: 10,
    format: 'jsonl' as 'jsonl' | 'json'
  });

  // Track if component has mounted on client (for hydration safety)
  const [hasMounted, setHasMounted] = useState(false);

  // Storage keys for persistence
  const STORAGE_KEYS = {
    API_RESPONSE: 'audioscripts_api_response',
    TRANSCRIPTION_RESPONSE: 'audioscripts_transcription_response',
    GENERATED_TEMPLATES: 'audioscripts_generated_templates',
    SYNTHETIC_SCRIPT: 'audioscripts_synthetic_script',
    SYNTHETIC_TOPIC: 'audioscripts_synthetic_topic',
    TRAINING_DATASET: 'audioscripts_training_dataset',
    EXPORT_OPTIONS: 'audioscripts_export_options',
    FORM_DATA: 'audioscripts_form_data'
  };

  const setStatus = (message: string, type: "idle" | "loading" | "success" | "error") => {
    setStatusMessage(message);
    setStatusType(type);
  };

  // Storage utility functions
  // Check if we're in the browser environment
  const isBrowser = typeof window !== 'undefined';

  const saveToStorage = (key: string, data: any) => {
    if (!isBrowser) return;
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }));
      console.log(`[Storage] Saved ${key}`);
    } catch (error) {
      console.warn(`[Storage] Failed to save ${key}:`, error);
    }
  };

  const loadFromStorage = (key: string) => {
    if (!isBrowser) return null;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log(`[Storage] Loaded ${key} from ${parsed.timestamp}`);
        return parsed.data;
      }
    } catch (error) {
      console.warn(`[Storage] Failed to load ${key}:`, error);
    }
    return null;
  };

  const clearStorage = (key?: string) => {
    if (!isBrowser) return;
    try {
      if (key) {
        localStorage.removeItem(key);
        console.log(`[Storage] Cleared ${key}`);
      } else {
        // Clear all AudioScripts data
        Object.values(STORAGE_KEYS).forEach(storageKey => {
          localStorage.removeItem(storageKey);
        });
        console.log('[Storage] Cleared all AudioScripts data');
      }
    } catch (error) {
      console.warn('[Storage] Failed to clear storage:', error);
    }
  };

  const getStorageInfo = () => {
    if (!isBrowser) return {};
    const info: Record<string, any> = {};
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          info[name] = {
            timestamp: parsed.timestamp,
            hasData: !!parsed.data,
            size: stored.length
          };
        } catch (error) {
          info[name] = { error: 'Invalid JSON' };
        }
      }
    });
    return info;
  };

  // Load saved data on component mount
  useEffect(() => {
    if (!isBrowser) return;
    
    // Mark component as mounted for hydration safety
    setHasMounted(true);
    
    console.log('[Storage] Loading saved data on component mount...');
    
    // Load form data
    const savedFormData = loadFromStorage(STORAGE_KEYS.FORM_DATA);
    if (savedFormData) {
      setUsername(savedFormData.username || '');
      setPlatform(savedFormData.platform || 'tiktok');
      setVideoCount(savedFormData.videoCount || 40);
    }

    // Load API response
    const savedApiResponse = loadFromStorage(STORAGE_KEYS.API_RESPONSE);
    if (savedApiResponse) {
      setApiResponse(savedApiResponse);
      setStatus(`Loaded previous API response: ${savedApiResponse.extractedVideos?.length || 0} videos`, 'success');
    }

    // Load transcription response
    const savedTranscriptionResponse = loadFromStorage(STORAGE_KEYS.TRANSCRIPTION_RESPONSE);
    if (savedTranscriptionResponse) {
      setTranscriptionResponse(savedTranscriptionResponse);
      setTranscriptionStatus(`Loaded previous transcription results: ${savedTranscriptionResponse.data?.summary?.successful || 0} successful`);
    }

    // Load generated templates
    const savedTemplates = loadFromStorage(STORAGE_KEYS.GENERATED_TEMPLATES);
    if (savedTemplates) {
      setGeneratedTemplates(savedTemplates);
      const templateCount = savedTemplates.allTemplates?.length || 1;
      setTemplateGenerationStatus(`Loaded ${templateCount} saved templates`);
    }

    // Load synthetic script
    const savedSyntheticScript = loadFromStorage(STORAGE_KEYS.SYNTHETIC_SCRIPT);
    const savedSyntheticTopic = loadFromStorage(STORAGE_KEYS.SYNTHETIC_TOPIC);
    if (savedSyntheticScript) {
      setSyntheticScript(savedSyntheticScript);
      setSyntheticTopic(savedSyntheticTopic || '');
    }

    // Load training dataset
    const savedTrainingDataset = loadFromStorage(STORAGE_KEYS.TRAINING_DATASET);
    if (savedTrainingDataset) {
      setTrainingDataset(savedTrainingDataset);
      setExportStatus(`Loaded saved training dataset: ${savedTrainingDataset.dataset?.summary?.totalExamples || 0} examples`);
    }

    // Load export options
    const savedExportOptions = loadFromStorage(STORAGE_KEYS.EXPORT_OPTIONS);
    if (savedExportOptions) {
      setExportOptions(savedExportOptions);
    }

    const storageInfo = getStorageInfo();
    const savedSteps = Object.keys(storageInfo).length;
    if (savedSteps > 0) {
      console.log(`[Storage] Restored ${savedSteps} saved steps:`, storageInfo);
    }
  }, [isBrowser]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!username.trim()) {
      setStatus("Please enter a username", "error");
      return;
    }

    // Rate limiting check
    if (!rateLimiter.canMakeRequest()) {
      const waitTime = Math.ceil(rateLimiter.getWaitTime() / 1000);
      setStatus(`Rate limit reached. Please wait ${waitTime} seconds before trying again.`, "error");
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setStatus(`Initializing request for ${videoCount} videos...`, "loading");
    setApiResponse(null);
    setTranscriptionResponse(null); // Clear previous transcription results

    try {
      // Record the API call for rate limiting
      rateLimiter.recordCall();

      const response = await fetch("/api/process-creator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          username: username.trim(), 
          platform,
          videoCount
        }),
        signal: abortControllerRef.current.signal,
      });

      const result: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      const extractedCount = result.extractedVideos?.length || 0;
      const hasMore = result.pagination?.hasMore || false;
      
      setStatus(
        `Successfully processed ${platform} profile: @${username} (${extractedCount}/${videoCount} videos${hasMore ? ', more available' : ''})`, 
        "success"
      );
      setApiResponse(result);
      
      // Save API response and form data
      saveToStorage(STORAGE_KEYS.API_RESPONSE, result);
      saveToStorage(STORAGE_KEYS.FORM_DATA, { username, platform, videoCount });
      
      // Log the response for debugging
      console.log("=== API Response Debug Info ===");
      console.log("Platform:", result.platform);
      console.log("Username:", result.username);
      console.log("Requested videos:", videoCount);
      console.log("Extracted videos:", extractedCount);
      console.log("Has more:", hasMore);
      console.log("Raw API Data:", result.data);
      console.log("================================");

    } catch (error: any) {
      if (error.name === 'AbortError') {
        setStatus("Request cancelled", "idle");
      } else {
        console.error("Creator processor error:", error);
        setStatus(`Error: ${error.message}`, "error");
        setApiResponse({
          success: false,
          error: error.message,
          platform,
          username
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleTranscribe = async () => {
    if (!apiResponse?.extractedVideos || apiResponse.extractedVideos.length === 0) {
      setTranscriptionStatus("No videos available for transcription");
      return;
    }

    // Cancel any existing transcription request
    if (transcriptionAbortRef.current) {
      transcriptionAbortRef.current.abort();
    }

    // Create new abort controller for transcription
    transcriptionAbortRef.current = new AbortController();

    setIsTranscribing(true);
    const modeText = fastMode ? "fast transcription" : "marketing analysis";
    setTranscriptionStatus(`Starting ${modeText} of ${apiResponse.extractedVideos.length} videos...`);
    setTranscriptionResponse(null);

    try {
      // Convert extracted videos to transcription format
      const transcriptionRequest = {
        videos: apiResponse.extractedVideos
          .filter(video => video.video_url) // Only include videos with valid URLs
          .map(video => ({
            id: video.id,
            url: video.video_url!,
            platform: video.platform as 'tiktok' | 'instagram',
            description: `${video.platform} video - ${video.quality}`
          })),
        options: {
          extractMarketingSegments: !fastMode, // Only enable marketing analysis if not in fast mode
          fastMode: fastMode, // Enable fast mode based on toggle
          includeVisualDescriptions: false,
          model: 'gemini-2.0-flash' as const
        }
      };

      const processText = fastMode ? "transcribing" : "analyzing for marketing segments";
      setTranscriptionStatus(`Downloading and ${processText} ${transcriptionRequest.videos.length} videos...`);

      const response = await fetch("/api/transcribe-videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transcriptionRequest),
        signal: transcriptionAbortRef.current.signal,
      });

      const result: TranscriptionResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      const successCount = result.data?.summary.successful || 0;
      const totalCount = result.data?.summary.totalVideos || 0;
      const processingTime = Math.round((result.data?.summary.processingTime || 0) / 1000);

      const completionText = fastMode ? "Transcription" : "Marketing analysis";
      setTranscriptionStatus(
        `${completionText} complete! ${successCount}/${totalCount} videos processed in ${processingTime}s`
      );
      setTranscriptionResponse(result);
      
      // Save transcription response
      saveToStorage(STORAGE_KEYS.TRANSCRIPTION_RESPONSE, result);

      // Log the transcription response for debugging
      console.log("=== Marketing Analysis Response Debug Info ===");
      console.log("Success:", result.success);
      console.log("Total videos:", totalCount);
      console.log("Successful:", successCount);
      console.log("Failed:", (result.data?.summary.failed || 0));
      console.log("Processing time:", processingTime + "s");
      console.log("Google Drive:", result.data?.googleDrive);
      console.log("Raw analysis data:", result.data);
      console.log("===============================================");

    } catch (error: any) {
      if (error.name === 'AbortError') {
        const cancelText = fastMode ? "Transcription" : "Marketing analysis";
        setTranscriptionStatus(`${cancelText} cancelled`);
      } else {
        const errorText = fastMode ? "Transcription" : "Marketing analysis";
        console.error(`${errorText} error:`, error);
        setTranscriptionStatus(`${errorText} failed: ${error.message}`);
        setTranscriptionResponse({
          success: false,
          error: error.message
        });
      }
    } finally {
      setIsTranscribing(false);
      transcriptionAbortRef.current = null;
    }
  };

  const handleCancelTranscription = () => {
    if (transcriptionAbortRef.current) {
      transcriptionAbortRef.current.abort();
    }
  };

  const handleGenerateTemplates = async () => {
    if (!transcriptionResponse?.data?.transcriptionResults) {
      setTemplateGenerationStatus("No transcription results available");
      return;
    }

    // Find ALL successful results with marketing segments
    const successfulResults = transcriptionResponse.data.transcriptionResults.filter(
      result => result.success && result.marketingSegments
    );

    if (successfulResults.length === 0) {
      setTemplateGenerationStatus("No successful transcriptions with marketing segments found");
      return;
    }

    setTemplateGenerationStatus(`Generating templates from ${successfulResults.length} successful scripts...`);
    setGeneratedTemplates(null);

    try {
      // Generate templates from all successful results
      const allTemplates = [];
      let totalProcessingTime = 0;

      for (let i = 0; i < successfulResults.length; i++) {
        const result = successfulResults[i];
        setTemplateGenerationStatus(`Generating templates from script ${i + 1}/${successfulResults.length}...`);

        const response = await fetch("/api/generate-templates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "generate-template",
            marketingSegments: result.marketingSegments
          }),
        });

        const templateResult = await response.json();

        if (!response.ok) {
          console.warn(`Failed to generate template for script ${i + 1}:`, templateResult.error);
          continue;
        }

        if (templateResult.success && templateResult.data.template) {
          allTemplates.push({
            ...templateResult.data.template,
            sourceVideoId: result.videoId,
            sourceMetadata: {
              viewCount: apiResponse?.extractedVideos?.find(v => v.id === result.videoId)?.viewCount,
              likeCount: apiResponse?.extractedVideos?.find(v => v.id === result.videoId)?.likeCount
            }
          });
          totalProcessingTime += templateResult.data.processingTime;
        }
      }

      if (allTemplates.length > 0) {
        // Store all templates (we'll use the first one for UI display but keep all for export)
        const templatesData = {
          ...allTemplates[0], // Display first template in UI
          allTemplates // Store all templates for export
        };
        setGeneratedTemplates(templatesData);
        
        // Save generated templates
        saveToStorage(STORAGE_KEYS.GENERATED_TEMPLATES, templatesData);
        
        const avgProcessingTime = Math.round(totalProcessingTime / allTemplates.length / 1000);
        setTemplateGenerationStatus(
          `Successfully generated ${allTemplates.length} templates from ${successfulResults.length} scripts ` +
          `(avg ${avgProcessingTime}s per template). Ready for synthetic script generation!`
        );
      } else {
        throw new Error("Failed to generate any templates from the scripts");
      }

    } catch (error: any) {
      console.error("Template generation error:", error);
      setTemplateGenerationStatus(`Template generation failed: ${error.message}`);
    }
  };

  const handleGenerateSyntheticScript = async () => {
    if (!generatedTemplates || !syntheticTopic.trim()) {
      setTemplateGenerationStatus("Please enter a topic and generate templates first");
      return;
    }

    setTemplateGenerationStatus(`Generating synthetic script for topic: "${syntheticTopic}"...`);
    setSyntheticScript(null);

    try {
      const response = await fetch("/api/generate-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "generate-script",
          topic: syntheticTopic,
          template: generatedTemplates
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (result.success && result.data.script) {
        setSyntheticScript(result.data.script);
        
        // Save synthetic script and topic
        saveToStorage(STORAGE_KEYS.SYNTHETIC_SCRIPT, result.data.script);
        saveToStorage(STORAGE_KEYS.SYNTHETIC_TOPIC, syntheticTopic);
        
        setTemplateGenerationStatus(`Synthetic script generated successfully in ${Math.round(result.data.processingTime / 1000)}s`);
      } else {
        throw new Error(result.data.error || "Failed to generate synthetic script");
      }

    } catch (error: any) {
      console.error("Synthetic script generation error:", error);
      setTemplateGenerationStatus(`Synthetic script generation failed: ${error.message}`);
    }
  };

  const handleGenerateAllSyntheticScripts = async () => {
    if (!generatedTemplates) {
      setTemplateGenerationStatus("Please generate templates first");
      return;
    }

    const defaultTopics = [
      'productivity tips',
      'social media growth', 
      'healthy eating',
      'fitness motivation',
      'business advice'
    ];

    setTemplateGenerationStatus(`Generating ${defaultTopics.length} synthetic scripts automatically...`);
    setSyntheticScript(null);

    try {
      const syntheticScripts = [];
      let totalProcessingTime = 0;

      for (let i = 0; i < defaultTopics.length; i++) {
        const topic = defaultTopics[i];
        setTemplateGenerationStatus(`Generating synthetic script ${i + 1}/${defaultTopics.length}: "${topic}"...`);

        const response = await fetch("/api/generate-templates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "generate-script",
            topic,
            template: generatedTemplates
          }),
        });

        const result = await response.json();

        if (response.ok && result.success && result.data.script) {
          syntheticScripts.push({
            topic,
            script: result.data.script,
            processingTime: result.data.processingTime
          });
          totalProcessingTime += result.data.processingTime;
        } else {
          console.warn(`Failed to generate synthetic script for topic "${topic}":`, result.error);
        }
      }

      if (syntheticScripts.length > 0) {
        // Display the first generated script
        setSyntheticScript(syntheticScripts[0].script);
        setSyntheticTopic(syntheticScripts[0].topic);
        
        // Save synthetic script and topic
        saveToStorage(STORAGE_KEYS.SYNTHETIC_SCRIPT, syntheticScripts[0].script);
        saveToStorage(STORAGE_KEYS.SYNTHETIC_TOPIC, syntheticScripts[0].topic);
        
        const avgProcessingTime = Math.round(totalProcessingTime / syntheticScripts.length / 1000);
        setTemplateGenerationStatus(
          `Successfully generated ${syntheticScripts.length} synthetic scripts ` +
          `(avg ${avgProcessingTime}s per script). Displaying "${syntheticScripts[0].topic}" script.`
        );

        // Store all synthetic scripts for export
        const updatedTemplates = {
          ...generatedTemplates,
          syntheticScripts
        };
        setGeneratedTemplates(updatedTemplates);
        
        // Save updated templates with synthetic scripts
        saveToStorage(STORAGE_KEYS.GENERATED_TEMPLATES, updatedTemplates);
      } else {
        throw new Error("Failed to generate any synthetic scripts");
      }

    } catch (error: any) {
      console.error("Synthetic script generation error:", error);
      setTemplateGenerationStatus(`Synthetic script generation failed: ${error.message}`);
    }
  };

  const handleExportTrainingData = async () => {
    if (!transcriptionResponse?.data?.transcriptionResults || !generatedTemplates) {
      setExportStatus("Please complete transcription and generate templates first");
      return;
    }

    // Check if synthetic scripts are requested but not generated
    if (exportOptions.includeSynthetic && (!generatedTemplates.syntheticScripts || generatedTemplates.syntheticScripts.length === 0)) {
      setExportStatus("Synthetic scripts requested but not generated. Please generate synthetic scripts first or disable synthetic script inclusion.");
      return;
    }

    setExportStatus("Generating training dataset...");
    setTrainingDataset(null);

    try {
      // Prepare transcription results with metadata
      const transcriptionResults = transcriptionResponse.data.transcriptionResults
        .filter(result => result.success && result.marketingSegments)
        .map(result => ({
          ...result,
          metadata: {
            viewCount: apiResponse?.extractedVideos?.find(v => v.id === result.videoId)?.viewCount,
            likeCount: apiResponse?.extractedVideos?.find(v => v.id === result.videoId)?.likeCount,
            quality: apiResponse?.extractedVideos?.find(v => v.id === result.videoId)?.quality,
            fileSize: apiResponse?.extractedVideos?.find(v => v.id === result.videoId)?.fileSize
          }
        }));

      // Prepare synthetic scripts if they exist
      const syntheticScripts = generatedTemplates.syntheticScripts || [];
      console.log(`[TrainingDataExport] Found ${syntheticScripts.length} synthetic scripts to include`);

      const response = await fetch("/api/export-training-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "generate",
          transcriptionResults,
          templates: generatedTemplates.allTemplates || [generatedTemplates],
          syntheticScripts, // Pass the already-generated synthetic scripts
          options: {
            includeOriginalTranscriptions: exportOptions.includeOriginal,
            includeSyntheticScripts: exportOptions.includeSynthetic,
            maxExamplesPerVideo: exportOptions.maxExamplesPerVideo,
            format: exportOptions.format
          }
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (result.success && result.data.dataset) {
        setTrainingDataset(result.data);
        
        // Save training dataset and export options
        saveToStorage(STORAGE_KEYS.TRAINING_DATASET, result.data);
        saveToStorage(STORAGE_KEYS.EXPORT_OPTIONS, exportOptions);
        
        const { dataset, validation } = result.data;
        const processingTime = Math.round(result.data.processingTime / 1000);
        
        setExportStatus(
          `Training dataset generated! ${dataset.summary.totalExamples} examples ` +
          `(${dataset.summary.originalExamples} original + ${dataset.summary.syntheticExamples} synthetic) ` +
          `in ${processingTime}s`
        );

        // Log validation results
        if (validation.warnings.length > 0) {
          console.warn('[TrainingDataExport] Validation warnings:', validation.warnings);
        }
        if (!validation.valid) {
          console.error('[TrainingDataExport] Validation errors:', validation.errors);
        }
      } else {
        throw new Error(result.error || "Failed to generate training dataset");
      }

    } catch (error: any) {
      console.error("Training data export error:", error);
      setExportStatus(`Training data export failed: ${error.message}`);
    }
  };

  const handleDownloadTrainingData = async (format: 'jsonl' | 'json', includeMetadata: boolean = false) => {
    if (!trainingDataset?.dataset) {
      setExportStatus("No training dataset available for download");
      return;
    }

    try {
      setExportStatus(`Preparing ${format.toUpperCase()} download...`);

      const response = await fetch("/api/export-training-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "download",
          dataset: trainingDataset.dataset,
          format,
          includeMetadata
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Create download
      const blob = new Blob([await response.text()], { 
        type: format === 'jsonl' ? 'application/jsonl' : 'application/json' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `training-data-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportStatus(`${format.toUpperCase()} file downloaded successfully!`);

    } catch (error: any) {
      console.error("Download error:", error);
      setExportStatus(`Download failed: ${error.message}`);
    }
  };

  const getStatusIcon = () => {
    switch (statusType) {
      case "loading":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Hook':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Bridge':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Golden Nugget':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'WTA':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const WordLevelVisualization = ({ wordAssignments }: { wordAssignments: WordAssignment[] }) => {
    if (!wordAssignments || wordAssignments.length === 0) {
      return null;
    }

    const sortedWords = wordAssignments.sort((a, b) => a.position - b.position);
    
    return (
      <div className="space-y-3">
        <p className="font-medium text-sm">📝 Word-Level Category Assignment:</p>
        <div className="p-3 bg-gray-50 rounded text-sm leading-relaxed">
          {sortedWords.map((assignment, index) => (
            <span
              key={index}
              className={`inline-block px-1 py-0.5 m-0.5 rounded border text-xs ${getCategoryColor(assignment.category)}`}
              title={`${assignment.category} - Position ${assignment.position}`}
            >
              {assignment.word}
            </span>
          ))}
        </div>
        
        {/* Category Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {['Hook', 'Bridge', 'Golden Nugget', 'WTA'].map(category => {
            const count = sortedWords.filter(w => w.category === category).length;
            const percentage = ((count / sortedWords.length) * 100).toFixed(1);
            return (
              <div key={category} className={`p-2 rounded border ${getCategoryColor(category)}`}>
                <p className="font-medium">{category}</p>
                <p>{count} words ({percentage}%)</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSavedDataSection = () => {
    if (!hasMounted) return null;
    
    const storageInfo = getStorageInfo();
    const hasSavedData = Object.keys(storageInfo).length > 0;
    
    if (!hasSavedData) return null;
    
    return (
      <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-amber-800">💾 Saved Progress</h3>
            <p className="text-sm text-amber-700">You have saved data from previous sessions</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
                clearStorage();
                // Reset all state
                setApiResponse(null);
                setTranscriptionResponse(null);
                setGeneratedTemplates(null);
                setSyntheticScript(null);
                setSyntheticTopic('');
                setTrainingDataset(null);
                setStatusMessage('');
                setTranscriptionStatus('');
                setTemplateGenerationStatus('');
                setExportStatus('');
                window.location.reload(); // Refresh to ensure clean state
              }
            }}
            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
          >
            Clear All Data
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {Object.entries(storageInfo).map(([name, info]) => (
            <div key={name} className="p-2 bg-white rounded border border-amber-200">
              <p className="font-medium text-amber-800">{name.replace('_', ' ')}</p>
              <p className="text-xs text-amber-600">
                {new Date(info.timestamp).toLocaleDateString()} {new Date(info.timestamp).toLocaleTimeString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {(info.size / 1024).toFixed(1)}KB
              </p>
            </div>
          ))}
        </div>
        
        <div className="mt-3 p-2 bg-amber-100 rounded text-xs text-amber-700">
          <p><strong>💡 Tip:</strong> Your progress is automatically saved. You can close the browser and return later to continue where you left off.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Saved Data Section */}
      {renderSavedDataSection()}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Select
              value={platform}
              onValueChange={setPlatform}
              disabled={isLoading}
            >
              <SelectTrigger id="platform">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="videoCount">Video Count</Label>
            <Select
              value={videoCount.toString()}
              onValueChange={(value) => setVideoCount(parseInt(value))}
              disabled={isLoading}
            >
              <SelectTrigger id="videoCount">
                <SelectValue placeholder="Select count" />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((count) => (
                  <SelectItem key={count} value={count.toString()}>
                    {count} videos
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter username (without @)..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            type="submit" 
            disabled={isLoading || !username.trim()}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing {videoCount} videos...
              </>
            ) : (
              `Process ${videoCount} Videos`
            )}
          </Button>
          
          {isLoading && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>

      {/* Status Display */}
      {statusMessage && (
        <div className={`flex items-center gap-2 p-4 rounded-lg border ${
          statusType === "success" ? "bg-green-50 border-green-200" :
          statusType === "error" ? "bg-red-50 border-red-200" :
          statusType === "loading" ? "bg-blue-50 border-blue-200" :
          "bg-gray-50 border-gray-200"
        }`}>
          {getStatusIcon()}
          <span className="text-sm">{statusMessage}</span>
        </div>
      )}

      {/* API Response Debug Info */}
      {apiResponse && (
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg border">
            <h3 className="font-semibold mb-2">API Response Summary</h3>
            <div className="space-y-1 text-sm">
              <p><strong>Platform:</strong> {apiResponse.platform}</p>
              <p><strong>Username:</strong> @{apiResponse.username}</p>
              <p><strong>Status:</strong> {apiResponse.success ? "Success" : "Failed"}</p>
              {apiResponse.pagination && (
                <>
                  <p><strong>Requested:</strong> {apiResponse.pagination.totalRequested || videoCount} videos</p>
                  <p><strong>Extracted:</strong> {apiResponse.pagination.totalExtracted || apiResponse.extractedVideos?.length || 0} videos</p>
                  <p><strong>More Available:</strong> {apiResponse.pagination.hasMore ? "Yes" : "No"}</p>
                </>
              )}
              {apiResponse.error && (
                <p className="text-red-600"><strong>Error:</strong> {apiResponse.error}</p>
              )}
              <p className="text-muted-foreground mt-2">
                Check browser console for full response data
              </p>
            </div>
            
            {/* Individual Step Controls */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => clearStorage(STORAGE_KEYS.API_RESPONSE)}
                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
              >
                Clear API Data
              </button>
              <button
                onClick={() => {
                  const data = { apiResponse, formData: { username, platform, videoCount } };
                  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                }}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              >
                Copy API Data
              </button>
            </div>
          </div>

          {/* Extracted Videos Info */}
          {apiResponse.extractedVideos && apiResponse.extractedVideos.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold mb-2 text-blue-800">
                Extracted Videos ({apiResponse.extractedVideos.length}{apiResponse.pagination?.hasMore ? '+' : ''})
              </h3>
              <div className="space-y-3 text-sm max-h-96 overflow-y-auto">
                {apiResponse.extractedVideos.map((video, index) => (
                  <div key={video.id} className="p-3 bg-white rounded border">
                    <div className="space-y-2">
                      {/* Video Header */}
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p><strong>Video {index + 1}:</strong> {video.id}</p>
                          <p><strong>Quality:</strong> {video.quality}</p>
                          <p><strong>Platform:</strong> {video.platform}</p>
                          {(video.viewCount !== undefined || video.likeCount !== undefined) && (
                            <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                              {video.viewCount !== undefined && (
                                <span>👁️ {video.viewCount.toLocaleString()} views</span>
                              )}
                              {video.likeCount !== undefined && (
                                <span>❤️ {video.likeCount.toLocaleString()} likes</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {video.video_url && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                              Video ✓
                            </span>
                          )}
                          {video.thumbnail && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                              Thumb ✓
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Video URL */}
                      {video.video_url && (
                        <div className="space-y-1">
                          <p className="font-medium text-green-700">Video Download URL:</p>
                          <div className="p-2 bg-gray-100 rounded text-xs break-all">
                            <a 
                              href={video.video_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              {video.video_url}
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {/* Thumbnail URL */}
                      {video.thumbnail && (
                        <div className="space-y-1">
                          <p className="font-medium text-blue-700">Thumbnail URL:</p>
                          <div className="p-2 bg-gray-100 rounded text-xs break-all">
                            <a 
                              href={video.thumbnail} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              {video.thumbnail}
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        {video.video_url && (
                          <button
                            onClick={() => navigator.clipboard.writeText(video.video_url!)}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                          >
                            Copy Video URL
                          </button>
                        )}
                        {video.thumbnail && (
                          <button
                            onClick={() => navigator.clipboard.writeText(video.thumbnail!)}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                          >
                            Copy Thumbnail URL
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                Videos sorted by performance (view count) and ready for marketing analysis. Click URLs to open or use copy buttons.
                {apiResponse.pagination?.hasMore && (
                  <span className="text-blue-600"> More videos available - increase count to get additional content.</span>
                )}
              </p>
              
              {/* Transcription Section */}
              <div className="mt-4 pt-4 border-t border-blue-200">
                {/* Fast Mode Toggle */}
                <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="fast-mode" className="text-sm font-medium">
                          {fastMode ? "Fast Mode" : "Marketing Analysis Mode"}
                        </Label>
                        {fastMode ? (
                          <Zap className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-purple-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fastMode 
                          ? "Quick transcription only (3-6 seconds per video)" 
                          : "Detailed marketing analysis with segments (35-40 seconds per video)"
                        }
                      </p>
                    </div>
                    <Switch
                      id="fast-mode"
                      checked={fastMode}
                      onCheckedChange={setFastMode}
                      disabled={isTranscribing}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleTranscribe}
                    disabled={isTranscribing || !apiResponse.extractedVideos.some(v => v.video_url)}
                    className={`flex-1 ${fastMode ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {fastMode ? "Transcribing..." : "Analyzing..."}
                      </>
                    ) : (
                      <>
                        {fastMode ? (
                          <Zap className="mr-2 h-4 w-4" />
                        ) : (
                          <FileText className="mr-2 h-4 w-4" />
                        )}
                        {fastMode 
                          ? `Fast Transcribe ${apiResponse.extractedVideos.filter(v => v.video_url).length} Videos`
                          : `Analyze ${apiResponse.extractedVideos.filter(v => v.video_url).length} Videos for Marketing Segments`
                        }
                      </>
                    )}
                  </Button>
                  
                  {isTranscribing && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleCancelTranscription}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
                
                {transcriptionStatus && (
                  <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-sm">
                    <div className="flex items-center gap-2">
                      {isTranscribing && <Loader2 className="h-3 w-3 animate-spin" />}
                      <span>{transcriptionStatus}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Google Drive Info */}
          {apiResponse.googleDrive && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-semibold mb-2 text-green-800">Google Drive Archive (URL Extraction)</h3>
              <div className="space-y-1 text-sm">
                <p><strong>Folder:</strong> {apiResponse.googleDrive.folderName}</p>
                <p><strong>Folder ID:</strong> {apiResponse.googleDrive.folderId}</p>
                {apiResponse.googleDrive.metadataFileId && (
                  <p><strong>Metadata File ID:</strong> {apiResponse.googleDrive.metadataFileId}</p>
                )}
                <div className="mt-3">
                  <a 
                    href={apiResponse.googleDrive.folderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors"
                  >
                    View in Google Drive
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Transcription Results */}
          {transcriptionResponse && (
            <div className={`p-4 rounded-lg border ${fastMode ? 'bg-yellow-50 border-yellow-200' : 'bg-purple-50 border-purple-200'}`}>
              <h3 className={`font-semibold mb-2 ${fastMode ? 'text-yellow-800' : 'text-purple-800'}`}>
                {fastMode ? "Fast Transcription Results" : "Marketing Analysis Results"}
                {transcriptionResponse.data?.summary && (
                  <span className="ml-2 text-sm font-normal">
                    ({transcriptionResponse.data.summary.successful}/{transcriptionResponse.data.summary.totalVideos} successful)
                  </span>
                )}
              </h3>
              
              {transcriptionResponse.success && transcriptionResponse.data ? (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="p-3 bg-white rounded border">
                    <h4 className="font-medium mb-2">Processing Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Videos</p>
                        <p className="font-semibold">{transcriptionResponse.data.summary.totalVideos}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Successful</p>
                        <p className="font-semibold text-green-600">{transcriptionResponse.data.summary.successful}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Failed</p>
                        <p className="font-semibold text-red-600">{transcriptionResponse.data.summary.failed}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Processing Time</p>
                        <p className="font-semibold">{Math.round(transcriptionResponse.data.summary.processingTime / 1000)}s</p>
                      </div>
                    </div>
                  </div>

                  {/* Individual Results */}
                  {transcriptionResponse.data.transcriptionResults && transcriptionResponse.data.transcriptionResults.length > 0 && (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      <h4 className="font-medium">
                        {fastMode ? "Individual Transcriptions" : "Individual Marketing Analysis"}
                      </h4>
                      {transcriptionResponse.data.transcriptionResults.map((result, index) => (
                        <div key={result.videoId} className="p-3 bg-white rounded border">
                          <div className="space-y-2">
                            {/* Header */}
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">Video {index + 1}: {result.videoId}</p>
                                <p className="text-sm text-muted-foreground">
                                  Platform: {result.platform} • Processing: {result.processingTime}ms
                                </p>
                              </div>
                              <span className={`px-2 py-1 text-xs rounded ${
                                result.success 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {result.success ? 'Success' : 'Failed'}
                              </span>
                            </div>

                            {/* Content based on mode */}
                            {result.success && (
                              <div className="space-y-3">
                                {/* Marketing Segments - Only show in marketing analysis mode */}
                                {!fastMode && result.marketingSegments && (
                                  <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {/* Hook */}
                                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                                        <p className="font-medium text-sm text-yellow-800">🎣 Hook</p>
                                        <p className="text-sm mt-1">{result.marketingSegments.Hook}</p>
                                      </div>
                                      
                                      {/* Bridge */}
                                      <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                                        <p className="font-medium text-sm text-blue-800">🌉 Bridge</p>
                                        <p className="text-sm mt-1">{result.marketingSegments.Bridge}</p>
                                      </div>
                                      
                                      {/* Golden Nugget */}
                                      <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                                        <p className="font-medium text-sm text-amber-800">💎 Golden Nugget</p>
                                        <p className="text-sm mt-1">{result.marketingSegments["Golden Nugget"]}</p>
                                      </div>
                                      
                                      {/* WTA */}
                                      <div className="p-2 bg-green-50 border border-green-200 rounded">
                                        <p className="font-medium text-sm text-green-800">🎯 WTA (Why To Act)</p>
                                        <p className="text-sm mt-1">{result.marketingSegments.WTA}</p>
                                      </div>
                                    </div>

                                    {/* Word-Level Visualization */}
                                    {result.wordAssignments && result.wordAssignments.length > 0 && (
                                      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded">
                                        <WordLevelVisualization wordAssignments={result.wordAssignments} />
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Full Transcription - Always show */}
                                <div>
                                  <p className="font-medium text-sm">📝 {fastMode ? "Transcription" : "Full Transcription"}:</p>
                                  <div className="p-2 bg-gray-50 rounded text-sm max-h-32 overflow-y-auto">
                                    {result.transcription}
                                  </div>
                                </div>

                                {/* Copy Buttons */}
                                <div className="flex gap-2 flex-wrap">
                                  <button
                                    onClick={() => navigator.clipboard.writeText(result.transcription)}
                                    className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
                                  >
                                    Copy Transcription
                                  </button>
                                  {!fastMode && result.marketingSegments && (
                                    <button
                                      onClick={() => navigator.clipboard.writeText(JSON.stringify(result.marketingSegments, null, 2))}
                                      className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
                                    >
                                      Copy Marketing Segments
                                    </button>
                                  )}
                                  {!fastMode && result.wordAssignments && (
                                    <button
                                      onClick={() => navigator.clipboard.writeText(JSON.stringify(result.wordAssignments, null, 2))}
                                      className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors"
                                    >
                                      Copy Word Assignments
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Error Message */}
                            {!result.success && result.error && (
                              <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                                <p className="text-red-600"><strong>Error:</strong> {result.error}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Google Drive Marketing Analysis Archive */}
                  {transcriptionResponse.data.googleDrive && (
                    <div className="p-3 bg-white rounded border">
                      <h4 className="font-medium mb-2">Google Drive Marketing Analysis Archive</h4>
                      <div className="space-y-1 text-sm">
                        <p><strong>Folder:</strong> {transcriptionResponse.data.googleDrive.folderName}</p>
                        <p><strong>Files:</strong> {transcriptionResponse.data.googleDrive.files.length} uploaded</p>
                        <div className="mt-2 flex gap-2">
                          <a 
                            href={transcriptionResponse.data.googleDrive.folderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 bg-purple-600 text-white text-xs rounded-md hover:bg-purple-700 transition-colors"
                          >
                            <Download className="mr-1 h-3 w-3" />
                            View Marketing Analysis in Drive
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Template Generation Section - Only show in marketing analysis mode */}
                  {!fastMode && transcriptionResponse.data.transcriptionResults && 
                   transcriptionResponse.data.transcriptionResults.some(r => r.success && r.marketingSegments) && (
                    <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded border border-indigo-200">
                      <h4 className="font-medium mb-3 text-indigo-800">🎯 Template Generation & Synthetic Scripts</h4>
                      
                      {/* Generate Templates Button */}
                      <div className="space-y-3">
                        <div className="flex gap-2 items-center">
                          <button
                            onClick={handleGenerateTemplates}
                            className="px-3 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors"
                            disabled={!!(templateGenerationStatus && templateGenerationStatus.includes("Generating"))}
                          >
                            {templateGenerationStatus && templateGenerationStatus.includes("Generating") ? "Generating..." : "Generate Templates from All Scripts"}
                          </button>
                          <p className="text-sm text-muted-foreground">
                            Convert ALL successful marketing segments into reusable templates
                          </p>
                        </div>

                        {/* Template Generation Status */}
                        {templateGenerationStatus && (
                          <div className="p-2 bg-white rounded border text-sm">
                            <p className={templateGenerationStatus.includes("failed") ? "text-red-600" : "text-indigo-600"}>
                              {templateGenerationStatus}
                            </p>
                          </div>
                        )}

                        {/* Generated Templates Display */}
                        {generatedTemplates && (
                          <div className="space-y-3">
                            <h5 className="font-medium text-indigo-800">
                              📋 Generated Templates 
                              {generatedTemplates.allTemplates && (
                                <span className="text-sm font-normal text-indigo-600">
                                  ({generatedTemplates.allTemplates.length} templates from successful scripts)
                                </span>
                              )}
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                                <p className="font-medium text-sm text-yellow-800">🎣 Hook Template</p>
                                <p className="text-sm mt-1 font-mono">{generatedTemplates.hook}</p>
                              </div>
                              <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                                <p className="font-medium text-sm text-blue-800">🌉 Bridge Template</p>
                                <p className="text-sm mt-1 font-mono">{generatedTemplates.bridge}</p>
                              </div>
                              <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                                <p className="font-medium text-sm text-amber-800">💎 Golden Nugget Template</p>
                                <p className="text-sm mt-1 font-mono">{generatedTemplates.nugget}</p>
                              </div>
                              <div className="p-2 bg-green-50 border border-green-200 rounded">
                                <p className="font-medium text-sm text-green-800">🎯 WTA Template</p>
                                <p className="text-sm mt-1 font-mono">{generatedTemplates.wta}</p>
                              </div>
                            </div>

                            {/* Synthetic Script Generation */}
                            <div className="mt-4 p-3 bg-white rounded border">
                              <h5 className="font-medium text-indigo-800 mb-2">✨ Generate Synthetic Scripts</h5>
                              <div className="space-y-3">
                                {/* Automatic Generation */}
                                <div className="flex gap-2 items-center">
                                  <button
                                    onClick={handleGenerateAllSyntheticScripts}
                                    disabled={!!(templateGenerationStatus && templateGenerationStatus.includes("Generating"))}
                                    className="px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                                  >
                                    Auto-Generate 5 Synthetic Scripts
                                  </button>
                                  <p className="text-sm text-muted-foreground">
                                    Automatically create scripts for: productivity, social media, health, fitness, business
                                  </p>
                                </div>
                                
                                {/* Manual Generation */}
                                <div className="border-t pt-2">
                                  <p className="text-xs text-muted-foreground mb-2">Or generate a custom topic:</p>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={syntheticTopic}
                                      onChange={(e) => setSyntheticTopic(e.target.value)}
                                      placeholder="Enter a custom topic..."
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                                    />
                                    <button
                                      onClick={handleGenerateSyntheticScript}
                                                                              disabled={!syntheticTopic.trim() || (!!(templateGenerationStatus && templateGenerationStatus.includes("Generating")))}
                                      className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
                                    >
                                      Generate Custom
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Generated Synthetic Script */}
                            {syntheticScript && (
                              <div className="space-y-3">
                                <h5 className="font-medium text-purple-800">🎬 Generated Synthetic Script</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                                    <p className="font-medium text-sm text-yellow-800">🎣 Hook</p>
                                    <p className="text-sm mt-1">{syntheticScript.Hook}</p>
                                  </div>
                                  <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                                    <p className="font-medium text-sm text-blue-800">🌉 Bridge</p>
                                    <p className="text-sm mt-1">{syntheticScript.Bridge}</p>
                                  </div>
                                  <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                                    <p className="font-medium text-sm text-amber-800">💎 Golden Nugget</p>
                                    <p className="text-sm mt-1">{syntheticScript["Golden Nugget"]}</p>
                                  </div>
                                  <div className="p-2 bg-green-50 border border-green-200 rounded">
                                    <p className="font-medium text-sm text-green-800">🎯 WTA</p>
                                    <p className="text-sm mt-1">{syntheticScript.WTA}</p>
                                  </div>
                                </div>

                                {/* Copy Buttons for Templates and Synthetic Script */}
                                <div className="flex gap-2 flex-wrap">
                                  <button
                                    onClick={() => navigator.clipboard.writeText(JSON.stringify(generatedTemplates, null, 2))}
                                    className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors"
                                  >
                                    Copy Templates
                                  </button>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(JSON.stringify(syntheticScript, null, 2))}
                                    className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
                                  >
                                    Copy Synthetic Script
                                  </button>
                                  <button
                                    onClick={() => {
                                      const fullScript = `${syntheticScript.Hook} ${syntheticScript.Bridge} ${syntheticScript["Golden Nugget"]} ${syntheticScript.WTA}`;
                                      navigator.clipboard.writeText(fullScript);
                                    }}
                                    className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
                                  >
                                    Copy Full Script
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Template Copy Button */}
                            {!syntheticScript && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => navigator.clipboard.writeText(JSON.stringify(generatedTemplates, null, 2))}
                                  className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors"
                                >
                                  Copy Templates
                                </button>
                              </div>
                            )}

                            {/* Training Data Export Section */}
                            <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded border border-emerald-200">
                              <h5 className="font-medium text-emerald-800 mb-3">🚀 Export Training Data for Fine-Tuning</h5>
                              
                              {/* Export Options */}
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  <label className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      checked={exportOptions.includeOriginal}
                                      onChange={(e) => setExportOptions(prev => ({ ...prev, includeOriginal: e.target.checked }))}
                                      className="rounded"
                                    />
                                    <span>Original Scripts</span>
                                  </label>
                                  <label className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      checked={exportOptions.includeSynthetic}
                                      onChange={(e) => setExportOptions(prev => ({ ...prev, includeSynthetic: e.target.checked }))}
                                      className="rounded"
                                    />
                                    <span>Synthetic Scripts</span>
                                  </label>
                                  <div className="flex items-center space-x-2">
                                    <label className="text-xs">Max per video:</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="20"
                                      value={exportOptions.maxExamplesPerVideo}
                                      onChange={(e) => setExportOptions(prev => ({ ...prev, maxExamplesPerVideo: parseInt(e.target.value) || 10 }))}
                                      className="w-16 px-1 py-1 border rounded text-xs"
                                    />
                                  </div>
                                  <select
                                    value={exportOptions.format}
                                    onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as 'jsonl' | 'json' }))}
                                    className="px-2 py-1 border rounded text-xs"
                                  >
                                    <option value="jsonl">JSONL (Gemini)</option>
                                    <option value="json">JSON (Debug)</option>
                                  </select>
                                </div>

                                {/* Generate Dataset Button */}
                                <div className="flex gap-2 items-center">
                                  <button
                                    onClick={handleExportTrainingData}
                                    disabled={!generatedTemplates || (!!(exportStatus && exportStatus.includes("Generating")))}
                                    className="px-3 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                  >
                                    {exportStatus && exportStatus.includes("Generating") ? "Generating..." : "Generate Training Dataset"}
                                  </button>
                                  <div className="text-sm text-muted-foreground">
                                    <p>Create JSONL file for Gemini fine-tuning</p>
                                    {exportOptions.includeSynthetic && (!generatedTemplates?.syntheticScripts || generatedTemplates.syntheticScripts.length === 0) && (
                                      <p className="text-amber-600 mt-1">
                                        ⚠️ Synthetic scripts enabled but not generated. Click &quot;Auto-Generate 5 Synthetic Scripts&quot; above first.
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Export Status */}
                                {exportStatus && (
                                  <div className="p-2 bg-white rounded border text-sm">
                                    <p className={exportStatus.includes("failed") ? "text-red-600" : "text-emerald-600"}>
                                      {exportStatus}
                                    </p>
                                  </div>
                                )}

                                {/* Training Dataset Summary */}
                                {trainingDataset && (
                                  <div className="space-y-3">
                                    <h6 className="font-medium text-emerald-800">📊 Dataset Summary</h6>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                      <div className="p-2 bg-white rounded border">
                                        <p className="text-muted-foreground">Total Examples</p>
                                        <p className="font-semibold text-emerald-600">{trainingDataset.dataset.summary.totalExamples}</p>
                                      </div>
                                      <div className="p-2 bg-white rounded border">
                                        <p className="text-muted-foreground">Original</p>
                                        <p className="font-semibold text-blue-600">{trainingDataset.dataset.summary.originalExamples}</p>
                                      </div>
                                      <div className="p-2 bg-white rounded border">
                                        <p className="text-muted-foreground">Synthetic</p>
                                        <p className="font-semibold text-purple-600">{trainingDataset.dataset.summary.syntheticExamples}</p>
                                      </div>
                                      <div className="p-2 bg-white rounded border">
                                        <p className="text-muted-foreground">Topics</p>
                                        <p className="font-semibold text-amber-600">{trainingDataset.dataset.summary.topics.length}</p>
                                      </div>
                                    </div>

                                    {/* Validation Results */}
                                    {trainingDataset.validation && (
                                      <div className="p-2 bg-white rounded border text-sm">
                                        <p className="font-medium mb-1">
                                          Validation: <span className={trainingDataset.validation.valid ? "text-green-600" : "text-red-600"}>
                                            {trainingDataset.validation.valid ? "✅ Valid" : "❌ Issues Found"}
                                          </span>
                                        </p>
                                        {trainingDataset.validation.warnings.length > 0 && (
                                          <div className="text-yellow-600 text-xs">
                                            <p>Warnings: {trainingDataset.validation.warnings.length}</p>
                                          </div>
                                        )}
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Avg lengths: {trainingDataset.validation.stats.avgInputLength} input, {trainingDataset.validation.stats.avgOutputLength} output chars
                                        </div>
                                      </div>
                                    )}

                                    {/* Download Buttons */}
                                    <div className="flex gap-2 flex-wrap">
                                      <button
                                        onClick={() => handleDownloadTrainingData('jsonl', false)}
                                        className="px-3 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 transition-colors"
                                      >
                                        📥 Download JSONL (Gemini Fine-tuning)
                                      </button>
                                      <button
                                        onClick={() => handleDownloadTrainingData('json', true)}
                                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                      >
                                        📥 Download JSON (with metadata)
                                      </button>
                                      <button
                                        onClick={() => navigator.clipboard.writeText(JSON.stringify(trainingDataset.dataset, null, 2))}
                                        className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
                                      >
                                        Copy Dataset
                                      </button>
                                    </div>

                                    {/* Topics Preview */}
                                    {trainingDataset.dataset.summary.topics.length > 0 && (
                                      <div className="p-2 bg-white rounded border text-sm">
                                        <p className="font-medium mb-1">Topics Covered:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {trainingDataset.dataset.summary.topics.slice(0, 10).map((topic: string, index: number) => (
                                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                              {topic}
                                            </span>
                                          ))}
                                          {trainingDataset.dataset.summary.topics.length > 10 && (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                              +{trainingDataset.dataset.summary.topics.length - 10} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Fine-Tuning Section */}
                            {trainingDataset && (
                              <FineTuningSection 
                                trainingDataset={trainingDataset.dataset}
                                onJobStarted={(job) => {
                                  console.log('Fine-tuning job started:', job);
                                  // Could add job tracking state here
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-600 text-sm">
                    <strong>Marketing Analysis Failed:</strong> {transcriptionResponse.error || 'Unknown error occurred'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rate Limiting Info */}
      <div className="text-xs text-muted-foreground text-center">
        Rate limit: {rateLimiter.maxCalls} requests per minute to prevent API abuse
      </div>
    </div>
  );
} 