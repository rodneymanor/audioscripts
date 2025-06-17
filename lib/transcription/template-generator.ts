import { GeminiClient } from './gemini-client';
import { MarketingSegments } from './types';

export interface ScriptTemplate {
  hook: string;
  bridge: string;
  nugget: string;
  wta: string;
}

export interface TemplateGenerationResult {
  success: boolean;
  template?: ScriptTemplate;
  error?: string;
  processingTime: number;
}

export interface SyntheticScriptResult {
  success: boolean;
  script?: MarketingSegments;
  error?: string;
  processingTime: number;
}

export class TemplateGenerator {
  private geminiClient: GeminiClient;

  constructor(geminiApiKey?: string) {
    this.geminiClient = new GeminiClient(geminiApiKey);
  }

  /**
   * Convert a specific marketing segment into a generic, reusable template
   */
  async createTemplateFromComponent(
    componentText: string,
    componentType: 'hook' | 'bridge' | 'nugget' | 'wta'
  ): Promise<{ success: boolean; template?: string; error?: string }> {
    const startTime = Date.now();
    
    try {
      console.log(`[TemplateGenerator] Creating template for ${componentType}: ${componentText.substring(0, 100)}...`);
      
      const prompt = `You are an expert in content strategy and pattern recognition. Your task is to convert a specific script component into a generic, reusable template. Analyze the provided text and identify its underlying structure. Replace specific nouns, topics, and outcomes with generic, bracketed placeholders like [Topic], [Target Audience], [Common Problem], [Desired Outcome], [Specific Action], or [Benefit]. The goal is to create a template that can be adapted to ANY subject.

**Example:**
- **Specific Text:** "If you want your videos to look pro, here is why you need to stop using your back camera."
- **Generated Template:** "If you want to achieve [Desired Outcome], here is why you need to stop [Common Mistake]."

**Component Type:** ${componentType.toUpperCase()}
**Specific Text to Analyze:**
"${componentText}"

**CRITICAL OUTPUT REQUIREMENT:** 
Your response must start IMMEDIATELY with the opening brace { and contain NOTHING else except the JSON object.

Expected JSON format:
{
  "template": "Your generic template with [Placeholders] here",
  "placeholders": ["List", "of", "placeholder", "types", "used"],
  "explanation": "Brief explanation of the pattern identified"
}`;

      // Use the existing Gemini client but with a simple video structure for text processing
      const mockVideo = {
        buffer: Buffer.from('mock'),
        mimeType: 'text/plain',
        size: 0,
        metadata: { id: 'template-gen', url: '', platform: 'template' as const }
      };

      // We'll use a text-only approach by creating a custom request
      const response = await this.makeTemplateRequest(prompt);
      
      const processingTime = Date.now() - startTime;
      console.log(`[TemplateGenerator] Template created for ${componentType} in ${processingTime}ms`);
      
      return {
        success: true,
        template: response.template,
        error: undefined
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[TemplateGenerator] Failed to create template for ${componentType}:`, error);
      
      return {
        success: false,
        template: undefined,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate templates for all marketing segments
   */
  async generateTemplatesFromSegments(segments: MarketingSegments): Promise<TemplateGenerationResult> {
    const startTime = Date.now();
    
    try {
      console.log('[TemplateGenerator] Generating templates from marketing segments');
      
      // Create templates for each segment
      const [hookResult, bridgeResult, nuggetResult, wtaResult] = await Promise.all([
        this.createTemplateFromComponent(segments.Hook, 'hook'),
        this.createTemplateFromComponent(segments.Bridge, 'bridge'),
        this.createTemplateFromComponent(segments["Golden Nugget"], 'nugget'),
        this.createTemplateFromComponent(segments.WTA, 'wta')
      ]);

      // Check if all templates were created successfully
      if (!hookResult.success || !bridgeResult.success || !nuggetResult.success || !wtaResult.success) {
        const errors = [
          hookResult.error && `Hook: ${hookResult.error}`,
          bridgeResult.error && `Bridge: ${bridgeResult.error}`,
          nuggetResult.error && `Nugget: ${nuggetResult.error}`,
          wtaResult.error && `WTA: ${wtaResult.error}`
        ].filter(Boolean).join('; ');
        
        throw new Error(`Template generation failed: ${errors}`);
      }

      const template: ScriptTemplate = {
        hook: hookResult.template!,
        bridge: bridgeResult.template!,
        nugget: nuggetResult.template!,
        wta: wtaResult.template!
      };

      const processingTime = Date.now() - startTime;
      console.log(`[TemplateGenerator] Successfully generated all templates in ${processingTime}ms`);
      
      return {
        success: true,
        template,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('[TemplateGenerator] Failed to generate templates:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      };
    }
  }

  /**
   * Generate a new script using templates and a topic
   */
  async generateSyntheticScript(topic: string, templates: ScriptTemplate): Promise<SyntheticScriptResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[TemplateGenerator] Generating synthetic script for topic: ${topic}`);
      
      const prompt = `You are an expert, creative scriptwriter AI. Your task is to generate a complete, cohesive, and compelling short-form video script based on a given topic and a set of structural templates. Fill in the placeholders in the provided templates to create a natural, engaging script about the specified topic.

**Topic to Write About:**
${topic}

**Script Templates:**
- **Hook Template:** "${templates.hook}"
- **Bridge Template:** "${templates.bridge}"
- **Golden Nugget Template:** "${templates.nugget}"
- **WTA Template:** "${templates.wta}"

**CRITICAL OUTPUT REQUIREMENT:** 
Your response must start IMMEDIATELY with the opening brace { and contain NOTHING else except the JSON object.

Expected JSON format:
{
  "Hook": "Complete hook text with placeholders filled in",
  "Bridge": "Complete bridge text with placeholders filled in", 
  "Golden Nugget": "Complete golden nugget text with placeholders filled in",
  "WTA": "Complete WTA text with placeholders filled in",
  "fullScript": "Complete script as one flowing piece of content"
}`;

      const response = await this.makeTemplateRequest(prompt);
      
      const processingTime = Date.now() - startTime;
      console.log(`[TemplateGenerator] Generated synthetic script for "${topic}" in ${processingTime}ms`);
      
      // Convert response to MarketingSegments format
      const script: MarketingSegments = {
        Hook: response.Hook || '',
        Bridge: response.Bridge || '',
        "Golden Nugget": response["Golden Nugget"] || '',
        WTA: response.WTA || ''
      };
      
      return {
        success: true,
        script,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[TemplateGenerator] Failed to generate synthetic script for "${topic}":`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      };
    }
  }

  /**
   * Make a direct text-based request to Gemini API for template generation
   */
  private async makeTemplateRequest(prompt: string): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response format from Gemini API');
      }

      const text = data.candidates[0].content.parts
        ?.map((part: any) => part.text)
        .join('') || '';

      if (!text.trim()) {
        throw new Error('Empty response from Gemini API');
      }

      // Parse JSON response
      try {
        // Clean up the response text - remove markdown code blocks and extra text
        let cleanedResponse = text.trim();
        
        // Remove markdown code blocks
        cleanedResponse = cleanedResponse.replace(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i, '$1');
        
        // Find JSON object
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed;
        } else {
          throw new Error('No JSON object found in response');
        }
      } catch (parseError) {
        console.error('[TemplateGenerator] Failed to parse JSON response:', text);
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
} 