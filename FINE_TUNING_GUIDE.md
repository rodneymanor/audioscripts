# Gemini Fine-Tuning Guide

This guide explains how to use the AudioScripts platform to fine-tune Gemini models for content creation.

## Overview

The AudioScripts fine-tuning system allows you to:
1. Extract and analyze successful social media content
2. Generate training datasets from proven content structures
3. Fine-tune Gemini models using Google Cloud Vertex AI
4. Monitor training progress and manage models

## Prerequisites

### 1. Google Cloud Setup

You'll need a Google Cloud project with the following APIs enabled:
- Vertex AI API
- Cloud Storage API
- AI Platform API

### 2. Service Account

Create a service account with the following roles:
- `AI Platform Admin`
- `Storage Admin`
- `Vertex AI User`

Download the service account key and extract:
- Service account email
- Private key

### 3. Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Required for fine-tuning
GOOGLE_CLOUD_PROJECT_ID=your-google-cloud-project-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# Required for content analysis
GEMINI_API_KEY=your_gemini_api_key_here

# Required for content extraction
RAPIDAPI_KEY=your_rapidapi_key_here
```

## Step-by-Step Process

### Step 1: Extract Content

1. Enter a creator's username (TikTok or Instagram)
2. Set video count (recommended: 40 for fine-tuning)
3. Click "Extract Videos" to get top-performing content

### Step 2: Analyze Content

1. Click "Transcribe & Analyze" to process videos
2. The system will:
   - Transcribe audio using Gemini
   - Analyze marketing segments (Hook, Bridge, Golden Nugget, WTA)
   - Categorize every word by marketing function

### Step 3: Generate Templates

1. Click "Generate Templates from All Scripts"
2. This creates reusable templates from successful content
3. Optionally generate synthetic variations with "Auto-Generate 5 Synthetic Scripts"

### Step 4: Export Training Data

1. Configure export options:
   - Include original scripts: ✓
   - Include synthetic scripts: ✓
   - Max examples per video: 10
   - Format: JSONL (for Gemini)

2. Click "Generate Training Dataset"
3. Download the JSONL file for fine-tuning

### Step 5: Fine-Tune Model

1. In the Fine-Tuning section, configure:
   - **Model Name**: Descriptive name for your model
   - **Base Model**: Choose from available Gemini models
   - **GCS Bucket**: Bucket name for storing training data
   - **Hyperparameters**: Epochs, learning rate, adapter size

2. Click "Start Fine-Tuning"
3. The system will:
   - Upload training data to Google Cloud Storage
   - Start the fine-tuning job on Vertex AI
   - Provide job monitoring interface

### Step 6: Monitor Training

1. View job status in the Fine-Tuning Jobs section
2. Track progress with real-time updates
3. Monitor for completion or errors
4. Cancel jobs if needed

## Configuration Options

### Model Settings
- **Display Name**: Unique identifier for your fine-tuning job
- **Base Model**: Choose from available Gemini models:
  - `gemini-2.0-flash-001` (Recommended for speed)
  - `gemini-2.5-flash-001` (Balanced performance)
  - `gemini-2.5-pro-001` (Maximum capability)
- **Region**: Google Cloud region for training (us-central1 recommended)

### System Prompt Configuration
- **System Prompt**: The instructions that will guide your fine-tuned model's behavior
- **Pre-loaded Template**: Includes the complete Hook-Bridge-Golden Nugget-WTA framework
- **Short Version Button**: Quick option for a concise system prompt
- **Character/Word Count**: Real-time feedback on prompt length
- **Copy Function**: Easy copying for external use

The system prompt is automatically saved alongside your training dataset in Google Cloud Storage for future reference.

### Storage Configuration
- **GCS Bucket Name**: Google Cloud Storage bucket for your training data
- **Dataset File Name**: Name for your training dataset file (.jsonl format)

### Hyperparameters
- **Epochs**: Number of training iterations (1-20, default: 3)
- **Learning Rate Multiplier**: Training speed adjustment (0.1-10, default: 1.0)  
- **Adapter Size**: Model adaptation complexity (1/2/4/8, default: 4)

## Training Data Format

The system generates training data in JSONL format:

```jsonl
{"input_text": "Create a hook for productivity content", "output_text": "You can't get off that fucking phone and that's the reason why you can't create shit."}
{"input_text": "Write a bridge connecting hook to main content", "output_text": "Let's talk about it. Now look, before y'all start typing..."}
```

Each example contains:
- **Input**: Instruction or prompt
- **Output**: Expected response based on successful content

## Monitoring and Management

### Job States

- **Queued**: Waiting to start
- **Pending**: Initializing resources
- **Running**: Active training
- **Completed**: Successfully finished
- **Failed**: Error occurred
- **Cancelled**: Manually stopped

### Progress Tracking

- Real-time status updates
- Progress percentage
- Training metrics (when available)
- Error details if issues occur

### Job Management

- **Refresh**: Update job status
- **Cancel**: Stop running jobs
- **View Details**: See complete job information

## Best Practices

### Data Quality

1. **Use High-Performing Content**: Extract from successful creators
2. **Diverse Examples**: Include various content types and topics
3. **Quality over Quantity**: 100-500 high-quality examples often better than thousands of poor ones

### Training Configuration

1. **Start Conservative**: Use default hyperparameters initially
2. **Monitor Closely**: Watch for overfitting or underfitting
3. **Iterate**: Adjust based on results

### Cost Management

1. **Estimate Costs**: Fine-tuning can be expensive
2. **Use Smaller Models**: Start with Flash models
3. **Optimize Dataset Size**: Remove redundant examples

## Troubleshooting

### Common Issues

1. **"Missing environment variables"**
   - Ensure all Google Cloud credentials are set
   - Check service account permissions

2. **"Failed to upload dataset"**
   - Verify GCS bucket permissions
   - Check bucket name uniqueness

3. **"Job failed to start"**
   - Validate training data format
   - Check Vertex AI API quotas

4. **"Configuration invalid"**
   - Review hyperparameter ranges
   - Ensure model availability in region

### Permission Errors

**Error: "storage.buckets.create access denied"**
- **Solution**: Grant `Storage Admin` role to your service account, or create the bucket manually
- **Alternative**: Use an existing bucket name in the configuration

**Error: "aiplatform.tuningJobs.create access denied"**  
- **Solution**: Grant `Vertex AI User` or `AI Platform Admin` role to your service account

### Bucket Issues

**Bucket Creation Failed**
1. **Manual Creation**: Create bucket in Google Cloud Console:
   - Go to Cloud Storage → Buckets → Create
   - Use the same name as in your fine-tuning configuration
   - Set location to match your Vertex AI region (e.g., `us-central1`)

2. **Use Existing Bucket**: Change the bucket name in fine-tuning configuration to an existing bucket

**Bucket Access Denied**
- Ensure your service account has `Storage Object Admin` role
- Verify the bucket exists and is in the correct project

### Configuration Issues

**Error: "Training dataset URI is required"**
- This error should not occur in the UI validation
- If you see this, ensure you're using the latest version of the code

**Error: "Invalid base model"**
- Use one of the supported models: `gemini-2.0-flash-001`, `gemini-2.5-flash-001`, `gemini-2.5-pro-001`

### API Errors

**Error: "Project not found"**
- Verify `GOOGLE_CLOUD_PROJECT_ID` environment variable is correct
- Ensure the project has Vertex AI API enabled

**Error: "Region not supported"**
- Use a supported region like `us-central1`, `us-east1`, or `europe-west1`
- Check [Vertex AI locations](https://cloud.google.com/vertex-ai/docs/general/locations) for current list

### Getting Help

1. Check job error details in the UI
2. Review Google Cloud logs
3. Verify API quotas and billing
4. Contact support with job names and error messages

## API Reference

The fine-tuning system provides a REST API at `/api/fine-tuning`:

### Start Job
```bash
POST /api/fine-tuning
{
  "action": "start-job",
  "config": {
    "displayName": "My Model",
    "baseModel": "gemini-2.0-flash-001",
    "trainingDatasetUri": "gs://bucket/dataset.jsonl",
    "hyperParameters": {
      "epochCount": 3,
      "learningRateMultiplier": 1.0,
      "adapterSize": 4
    }
  }
}
```

### Get Status
```bash
POST /api/fine-tuning
{
  "action": "get-status",
  "jobName": "projects/PROJECT/locations/REGION/tuningJobs/JOB_ID"
}
```

### List Jobs
```bash
POST /api/fine-tuning
{
  "action": "list-jobs",
  "pageSize": 10
}
```

## Pricing

Fine-tuning costs depend on:
- Base model size
- Training data size
- Number of epochs
- Training time

Refer to [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing) for current rates.

## Next Steps

After fine-tuning:
1. Test your model with sample prompts
2. Deploy for production use
3. Monitor performance metrics
4. Iterate with additional training data

For more information, see the [Google Cloud Vertex AI documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-supervised-tuning).

## Required Google Cloud Permissions

Your service account needs the following IAM roles:

### Essential Roles
- **Storage Admin** (`roles/storage.admin`) - For creating/managing Cloud Storage buckets
- **Vertex AI User** (`roles/aiplatform.user`) - For fine-tuning operations

### Alternative Minimal Roles
If you prefer minimal permissions:
- **Storage Object Admin** (`roles/storage.objectAdmin`) - If bucket already exists
- **Storage Bucket Creator** (`roles/storage.bucketCreator`) - For bucket creation only
- **Vertex AI Custom Job Editor** (`roles/aiplatform.customJobsEditor`) - For fine-tuning

### Granting Permissions

**Via Google Cloud Console:**
1. Go to IAM & Admin → Service Accounts
2. Find your service account
3. Click "Manage Keys" → "Permissions" 
4. Add the required roles

**Via gcloud CLI:**
```bash
# Grant Storage Admin role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.admin"

# Grant Vertex AI User role  
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
    --role="roles/aiplatform.user"
``` 

## System Prompt for Fine-Tuned Model

When deploying your fine-tuned Gemini model, use this system prompt to ensure optimal performance:

### Recommended System Prompt

```
You are an expert short-form video script writer trained on high-performing social media content from successful creators. Your specialty is creating compelling scripts that follow the proven Hook-Bridge-Golden Nugget-WTA structure for maximum engagement and virality.

## Your Framework (Hook-Bridge-Golden Nugget-WTA):

**HOOK** (First 3-5 seconds): Grab attention immediately
- Use pattern interrupts, bold statements, or intriguing questions
- Create curiosity gaps that demand resolution
- Speak directly to the viewer's pain points or desires
- Examples: "You can't get off that fucking phone and that's the reason why you can't create shit" or "If you're not doing this, you're wasting your time"

**BRIDGE** (Transition): Connect hook to main content
- Acknowledge the hook's premise
- Build credibility and relatability
- Set up the value proposition
- Examples: "Let's talk about it. Now look, before y'all start typing..." or "Here's what I learned after studying 1000+ successful creators"

**GOLDEN NUGGET** (Core Value): Deliver the main insight
- Provide actionable, specific advice
- Share counterintuitive or surprising information
- Give concrete steps or frameworks
- Make it immediately applicable
- Examples: Specific strategies, step-by-step processes, or revealing industry secrets

**WTA (What To Action)**: Clear next steps
- Tell viewers exactly what to do next
- Create urgency or motivation to act
- Can include follow requests, engagement prompts, or specific actions
- Examples: "Try this for 30 days and watch what happens" or "Comment below if you've experienced this"

## Your Writing Style:
- **Conversational and Direct**: Write like you're talking to a friend
- **Authentic Voice**: Use natural speech patterns, including appropriate emphasis
- **Engagement-Focused**: Every word should serve viewer retention
- **Platform-Optimized**: Designed for TikTok/Instagram short-form content
- **Action-Oriented**: Always drive toward specific outcomes

## Content Principles:
- Start with high-impact, attention-grabbing statements
- Use specific examples and concrete details
- Address common pain points and desires
- Provide immediate value in under 60 seconds
- End with clear, actionable next steps
- Maintain authenticity while maximizing engagement

## Your Task:
When given any topic or idea, transform it into a compelling short-form video script that follows the Hook-Bridge-Golden Nugget-WTA structure. Use the language patterns, intensity, and engagement techniques learned from successful creators while maintaining authenticity and providing genuine value.

Focus on creating scripts that:
1. Stop scrollers immediately (Hook)
2. Build connection and credibility (Bridge)  
3. Deliver transformative value (Golden Nugget)
4. Drive specific action (WTA)

Remember: Every script should feel like it could go viral while genuinely helping the viewer.
```

### Alternative Shorter System Prompt

For scenarios requiring a more concise prompt:

```
You are an expert short-form video script writer specializing in the Hook-Bridge-Golden Nugget-WTA framework. Transform any topic into compelling 30-60 second scripts that:

HOOK: Grab attention in 3-5 seconds with bold statements or curiosity gaps
BRIDGE: Connect hook to main content, build credibility  
GOLDEN NUGGET: Deliver specific, actionable value
WTA: Clear next steps for the viewer

Write in a conversational, direct style optimized for TikTok/Instagram. Use natural speech patterns and focus on maximum engagement while providing genuine value. Every script should stop scrollers and drive action.
```

### Usage Examples

**Input**: "Write a script about productivity tips"
**Expected Output**: A complete script following the framework with authentic language patterns learned from your training data.

**Input**: "Create content about social media growth"  
**Expected Output**: Hook-Bridge-Golden Nugget-WTA structured script using proven engagement techniques.

### Fine-Tuning the Prompt

After deploying your model, you may want to adjust the system prompt based on:
- Specific brand voice requirements
- Platform-specific optimizations  
- Content category focus
- Audience demographics
- Performance metrics

The system prompt can be modified while keeping the core framework intact to match your specific use case and brand requirements. 