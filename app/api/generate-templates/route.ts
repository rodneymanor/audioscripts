import { NextRequest, NextResponse } from 'next/server';
import { TranscriptionService } from '@/lib/transcription/transcription-service';
import { MarketingSegments, ScriptTemplate } from '@/lib/transcription/types';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('[TemplateAPI] Received template generation request');
    
    // Parse request body
    const body = await request.json();
    console.log('[TemplateAPI] Request body:', JSON.stringify(body, null, 2));
    
    const { action, marketingSegments, topic, template } = body;
    
    if (!action) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing action parameter. Use "generate-template" or "generate-script"' 
        },
        { status: 400 }
      );
    }

    // Check for required environment variables
    if (!process.env.GEMINI_API_KEY) {
      console.error('[TemplateAPI] Missing GEMINI_API_KEY environment variable');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Server configuration error: Missing Gemini API key' 
        },
        { status: 500 }
      );
    }

    // Initialize transcription service
    const transcriptionService = new TranscriptionService();
    
    if (action === 'generate-template') {
      // Generate templates from marketing segments
      if (!marketingSegments) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Missing marketingSegments for template generation' 
          },
          { status: 400 }
        );
      }

      console.log('[TemplateAPI] Generating templates from marketing segments');
      
      // Create a mock transcription result to use the existing method
      const mockResult = {
        videoId: 'template-gen',
        videoUrl: '',
        platform: 'template' as const,
        transcription: '',
        marketingSegments: marketingSegments as MarketingSegments,
        processingTime: 0,
        success: true
      };

      const templateResult = await transcriptionService.generateTemplatesFromResult(mockResult);
      
      const totalTime = Date.now() - startTime;
      console.log(`[TemplateAPI] Template generation completed in ${totalTime}ms`);

      return NextResponse.json({
        success: templateResult.success,
        data: {
          template: templateResult.template,
          processingTime: templateResult.processingTime,
          error: templateResult.error
        },
        timestamp: new Date().toISOString(),
        totalProcessingTime: totalTime
      });

    } else if (action === 'generate-script') {
      // Generate synthetic script from template and topic
      if (!topic || !template) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Missing topic or template for script generation' 
          },
          { status: 400 }
        );
      }

      console.log(`[TemplateAPI] Generating synthetic script for topic: ${topic}`);
      
      const scriptResult = await transcriptionService.generateSyntheticScript(
        topic, 
        template as ScriptTemplate
      );
      
      const totalTime = Date.now() - startTime;
      console.log(`[TemplateAPI] Script generation completed in ${totalTime}ms`);

      return NextResponse.json({
        success: scriptResult.success,
        data: {
          script: scriptResult.script,
          topic: topic,
          processingTime: scriptResult.processingTime,
          error: scriptResult.error
        },
        timestamp: new Date().toISOString(),
        totalProcessingTime: totalTime
      });

    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: `Unknown action: ${action}. Use "generate-template" or "generate-script"` 
        },
        { status: 400 }
      );
    }

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('[TemplateAPI] Request failed:', error);
    
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
    console.log('[TemplateAPI] Health check requested');
    
    const transcriptionService = new TranscriptionService();
    const healthStatus = await transcriptionService.getHealthStatus();
    
    return NextResponse.json({
      service: 'template-generation',
      ...healthStatus,
      endpoints: {
        generateTemplate: '/api/generate-templates (POST with action: "generate-template")',
        generateScript: '/api/generate-templates (POST with action: "generate-script")',
        health: '/api/generate-templates (GET)'
      },
      usage: {
        generateTemplate: {
          method: 'POST',
          body: {
            action: 'generate-template',
            marketingSegments: {
              Hook: 'Your hook text here',
              Bridge: 'Your bridge text here',
              'Golden Nugget': 'Your golden nugget text here',
              WTA: 'Your WTA text here'
            }
          }
        },
        generateScript: {
          method: 'POST',
          body: {
            action: 'generate-script',
            topic: 'Your topic here',
            template: {
              hook: 'Template with [Placeholders]',
              bridge: 'Template with [Placeholders]',
              nugget: 'Template with [Placeholders]',
              wta: 'Template with [Placeholders]'
            }
          }
        }
      }
    });
    
  } catch (error) {
    console.error('[TemplateAPI] Health check failed:', error);
    
    return NextResponse.json(
      {
        service: 'template-generation',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 