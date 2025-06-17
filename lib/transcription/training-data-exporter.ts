import { MarketingSegments, ScriptTemplate, TranscriptionResult } from './types';

export interface TrainingExample {
  input: string;
  output: string;
  metadata?: {
    source: 'original' | 'synthetic';
    videoId?: string;
    platform?: string;
    viewCount?: number;
    likeCount?: number;
    topic?: string;
    templateUsed?: boolean;
    processingTime?: number;
  };
}

export interface TrainingDataset {
  examples: TrainingExample[];
  summary: {
    totalExamples: number;
    originalExamples: number;
    syntheticExamples: number;
    platforms: string[];
    topics: string[];
    avgViewCount?: number;
    avgLikeCount?: number;
  };
  metadata: {
    createdAt: string;
    creator?: string;
    platform?: string;
    description: string;
  };
}

export interface ExportOptions {
  includeMetadata?: boolean;
  includeOriginalTranscriptions?: boolean;
  includeSyntheticScripts?: boolean;
  syntheticTopics?: string[];
  maxExamplesPerVideo?: number;
  minViewCount?: number;
  format?: 'jsonl' | 'json';
}

export class TrainingDataExporter {
  private static readonly DEFAULT_SYNTHETIC_TOPICS = [
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
  ];

  /**
   * Generate comprehensive training dataset from transcription results
   */
  static async generateTrainingDataset(
    transcriptionResults: TranscriptionResult[],
    templates: ScriptTemplate[],
    syntheticScripts: Array<{topic: string, script: MarketingSegments}> = [],
    options: ExportOptions = {}
  ): Promise<TrainingDataset> {
    const startTime = Date.now();
    
    console.log('[TrainingDataExporter] Starting training dataset generation');
    console.log(`[TrainingDataExporter] Input: ${transcriptionResults.length} transcriptions, ${templates.length} templates, ${syntheticScripts.length} synthetic scripts`);
    
    const {
      includeMetadata = true,
      includeOriginalTranscriptions = true,
      includeSyntheticScripts = true,
      syntheticTopics = this.DEFAULT_SYNTHETIC_TOPICS,
      maxExamplesPerVideo = 10,
      minViewCount = 0
    } = options;

    const examples: TrainingExample[] = [];
    const platforms = new Set<string>();
    const topics = new Set<string>();
    let totalViewCount = 0;
    let totalLikeCount = 0;
    let viewCountCount = 0;
    let likeCountCount = 0;

    // Filter successful transcriptions that meet criteria
    const validTranscriptions = transcriptionResults.filter(result => 
      result.success && 
      result.marketingSegments &&
      (result.metadata?.viewCount || 0) >= minViewCount
    );

    console.log(`[TrainingDataExporter] Processing ${validTranscriptions.length} valid transcriptions`);

    // Generate original training examples
    if (includeOriginalTranscriptions) {
      for (const result of validTranscriptions) {
        const example = this.createOriginalTrainingExample(result, includeMetadata);
        examples.push(example);
        
        platforms.add(result.platform);
        if (result.metadata?.viewCount) {
          totalViewCount += result.metadata.viewCount;
          viewCountCount++;
        }
        if (result.metadata?.likeCount) {
          totalLikeCount += result.metadata.likeCount;
          likeCountCount++;
        }
      }
      
      console.log(`[TrainingDataExporter] Generated ${examples.length} original training examples`);
    }

    // Generate synthetic training examples from pre-generated scripts
    if (includeSyntheticScripts && syntheticScripts.length > 0) {
      for (const syntheticScript of syntheticScripts) {
        const example = this.createSyntheticTrainingExample(
          syntheticScript.topic,
          syntheticScript.script,
          templates[0], // Use first template for metadata
          includeMetadata
        );
        examples.push(example);
        topics.add(syntheticScript.topic);
      }
      
      console.log(`[TrainingDataExporter] Added ${syntheticScripts.length} pre-generated synthetic training examples`);
    }

    const processingTime = Date.now() - startTime;
    console.log(`[TrainingDataExporter] Dataset generation completed in ${processingTime}ms`);

    // Create dataset summary
    const dataset: TrainingDataset = {
      examples,
      summary: {
        totalExamples: examples.length,
        originalExamples: examples.filter(e => e.metadata?.source === 'original').length,
        syntheticExamples: examples.filter(e => e.metadata?.source === 'synthetic').length,
        platforms: Array.from(platforms),
        topics: Array.from(topics),
        avgViewCount: viewCountCount > 0 ? Math.round(totalViewCount / viewCountCount) : undefined,
        avgLikeCount: likeCountCount > 0 ? Math.round(totalLikeCount / likeCountCount) : undefined
      },
      metadata: {
        createdAt: new Date().toISOString(),
        description: `Training dataset with ${examples.length} examples (${examples.filter(e => e.metadata?.source === 'original').length} original + ${examples.filter(e => e.metadata?.source === 'synthetic').length} synthetic)`
      }
    };

    return dataset;
  }

  /**
   * Create training example from original transcription
   */
  private static createOriginalTrainingExample(
    result: TranscriptionResult,
    includeMetadata: boolean
  ): TrainingExample {
    const segments = result.marketingSegments!;
    const fullScript = `${segments.Hook} ${segments.Bridge} ${segments["Golden Nugget"]} ${segments.WTA}`.trim();
    
    // Create input prompt based on content analysis
    const topic = this.extractTopicFromContent(fullScript);
    const input = `Write a compelling short-form video script about ${topic} that follows the Hook-Bridge-Golden Nugget-WTA structure for maximum engagement.`;
    
    const example: TrainingExample = {
      input,
      output: fullScript
    };

    if (includeMetadata) {
      example.metadata = {
        source: 'original',
        videoId: result.videoId,
        platform: result.platform,
        viewCount: result.metadata?.viewCount,
        likeCount: result.metadata?.likeCount,
        topic,
        templateUsed: false,
        processingTime: result.processingTime
      };
    }

    return example;
  }

  /**
   * Generate synthetic training examples using templates
   */
  private static async generateSyntheticExamples(
    templates: ScriptTemplate[],
    syntheticTopics: string[],
    maxExamplesPerVideo: number,
    includeMetadata: boolean,
    examples: TrainingExample[],
    topics: Set<string>
  ): Promise<number> {
    let syntheticCount = 0;
    
    // For each template, generate examples with different topics
    for (const template of templates) {
      const topicsToUse = syntheticTopics.slice(0, maxExamplesPerVideo);
      
      for (const topic of topicsToUse) {
        try {
          const syntheticScript = await this.generateSyntheticScript(topic, template);
          if (syntheticScript) {
            const example = this.createSyntheticTrainingExample(
              topic,
              syntheticScript,
              template,
              includeMetadata
            );
            examples.push(example);
            topics.add(topic);
            syntheticCount++;
          }
        } catch (error) {
          console.warn(`[TrainingDataExporter] Failed to generate synthetic script for topic "${topic}":`, error);
        }
      }
    }
    
    return syntheticCount;
  }

  /**
   * Generate synthetic script using template and topic
   */
  private static async generateSyntheticScript(
    topic: string,
    template: ScriptTemplate
  ): Promise<MarketingSegments | null> {
    try {
      const response = await fetch('/api/generate-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate-script',
          topic,
          template
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success && result.data.script) {
        return result.data.script;
      } else {
        console.warn(`[TrainingDataExporter] API error for topic "${topic}":`, result.error);
        return null;
      }
    } catch (error) {
      console.error(`[TrainingDataExporter] Network error for topic "${topic}":`, error);
      return null;
    }
  }

  /**
   * Create training example from synthetic script
   */
  private static createSyntheticTrainingExample(
    topic: string,
    script: MarketingSegments,
    template: ScriptTemplate,
    includeMetadata: boolean
  ): TrainingExample {
    const fullScript = `${script.Hook} ${script.Bridge} ${script["Golden Nugget"]} ${script.WTA}`.trim();
    const input = `Write a compelling short-form video script about ${topic} that follows the Hook-Bridge-Golden Nugget-WTA structure for maximum engagement.`;
    
    const example: TrainingExample = {
      input,
      output: fullScript
    };

    if (includeMetadata) {
      example.metadata = {
        source: 'synthetic',
        topic,
        templateUsed: true
      };
    }

    return example;
  }

  /**
   * Extract topic from content using simple heuristics
   */
  private static extractTopicFromContent(content: string): string {
    // Simple topic extraction - look for key phrases and subjects
    const words = content.toLowerCase().split(/\s+/);
    
    // Common topic indicators
    const topicKeywords = {
      'productivity': ['productive', 'efficiency', 'time', 'work', 'focus'],
      'fitness': ['workout', 'exercise', 'gym', 'health', 'fitness'],
      'business': ['business', 'entrepreneur', 'money', 'success', 'growth'],
      'social media': ['content', 'followers', 'engagement', 'viral', 'social'],
      'personal development': ['mindset', 'habits', 'goals', 'motivation', 'self'],
      'technology': ['tech', 'app', 'digital', 'online', 'software'],
      'relationships': ['relationship', 'dating', 'love', 'communication'],
      'creativity': ['creative', 'art', 'design', 'inspiration', 'ideas']
    };

    // Find best matching topic
    let bestTopic = 'general advice';
    let bestScore = 0;

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      const score = keywords.reduce((acc, keyword) => {
        return acc + words.filter(word => word.includes(keyword)).length;
      }, 0);
      
      if (score > bestScore) {
        bestScore = score;
        bestTopic = topic;
      }
    }

    return bestTopic;
  }

  /**
   * Export dataset to JSONL format
   */
  static exportToJSONL(dataset: TrainingDataset, includeMetadata: boolean = false): string {
    return dataset.examples
      .map(example => {
        const exportExample = {
          input: example.input,
          output: example.output,
          ...(includeMetadata && example.metadata ? { metadata: example.metadata } : {})
        };
        return JSON.stringify(exportExample);
      })
      .join('\n');
  }

  /**
   * Export dataset to JSON format
   */
  static exportToJSON(dataset: TrainingDataset, includeMetadata: boolean = true): string {
    const exportData = {
      ...dataset,
      examples: dataset.examples.map(example => ({
        input: example.input,
        output: example.output,
        ...(includeMetadata && example.metadata ? { metadata: example.metadata } : {})
      }))
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Create downloadable file content
   */
  static createDownloadableContent(
    dataset: TrainingDataset,
    format: 'jsonl' | 'json' = 'jsonl',
    includeMetadata: boolean = false
  ): { content: string; filename: string; mimeType: string } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    if (format === 'jsonl') {
      return {
        content: this.exportToJSONL(dataset, includeMetadata),
        filename: `training-data-${timestamp}.jsonl`,
        mimeType: 'application/jsonl'
      };
    } else {
      return {
        content: this.exportToJSON(dataset, includeMetadata),
        filename: `training-data-${timestamp}.json`,
        mimeType: 'application/json'
      };
    }
  }

  /**
   * Validate training dataset for Gemini fine-tuning requirements
   */
  static validateDataset(dataset: TrainingDataset): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    stats: {
      avgInputLength: number;
      avgOutputLength: number;
      minInputLength: number;
      maxInputLength: number;
      minOutputLength: number;
      maxOutputLength: number;
    };
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check minimum examples
    if (dataset.examples.length < 10) {
      warnings.push(`Dataset has only ${dataset.examples.length} examples. Recommended minimum is 10 for fine-tuning.`);
    }
    
    // Check for empty examples
    const emptyExamples = dataset.examples.filter(e => !e.input.trim() || !e.output.trim());
    if (emptyExamples.length > 0) {
      errors.push(`Found ${emptyExamples.length} examples with empty input or output.`);
    }
    
    // Calculate length statistics
    const inputLengths = dataset.examples.map(e => e.input.length);
    const outputLengths = dataset.examples.map(e => e.output.length);
    
    const stats = {
      avgInputLength: Math.round(inputLengths.reduce((a, b) => a + b, 0) / inputLengths.length),
      avgOutputLength: Math.round(outputLengths.reduce((a, b) => a + b, 0) / outputLengths.length),
      minInputLength: Math.min(...inputLengths),
      maxInputLength: Math.max(...inputLengths),
      minOutputLength: Math.min(...outputLengths),
      maxOutputLength: Math.max(...outputLengths)
    };
    
    // Check for very long examples (Gemini has token limits)
    const longInputs = dataset.examples.filter(e => e.input.length > 2000);
    const longOutputs = dataset.examples.filter(e => e.output.length > 4000);
    
    if (longInputs.length > 0) {
      warnings.push(`${longInputs.length} examples have very long inputs (>2000 chars). Consider shortening.`);
    }
    
    if (longOutputs.length > 0) {
      warnings.push(`${longOutputs.length} examples have very long outputs (>4000 chars). Consider shortening.`);
    }
    
    // Check for very short examples
    const shortOutputs = dataset.examples.filter(e => e.output.length < 50);
    if (shortOutputs.length > 0) {
      warnings.push(`${shortOutputs.length} examples have very short outputs (<50 chars). Consider adding more detail.`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats
    };
  }
} 