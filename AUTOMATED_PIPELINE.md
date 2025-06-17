# Automated Fine-Tuning Pipeline

The AudioScripts Automated Pipeline provides complete end-to-end automation from a single social media profile link to ready-to-use fine-tuning data.

## 🚀 What It Does

The automated pipeline handles the entire process:

1. **Extract Videos** - Pulls top-performing content from TikTok/Instagram profiles
2. **Analyze Content** - Transcribes and analyzes marketing segments (Hook, Bridge, Golden Nugget, WTA)
3. **Generate Templates** - Creates reusable content templates from successful scripts
4. **Create Synthetic Data** - Generates additional training examples using AI
5. **Export Training Data** - Produces JSONL/JSON files ready for Gemini fine-tuning

## 📖 How to Use

### Quick Start

1. Navigate to `/automated-pipeline` in your browser
2. Enter a creator's username (without @)
3. Select platform (TikTok or Instagram)
4. Configure options (or use defaults)
5. Click "Start Automated Pipeline"
6. Wait for completion and download your training data

### Configuration Options

#### Basic Settings
- **Creator Username**: The social media username to analyze
- **Platform**: Choose TikTok or Instagram
- **Video Count**: Number of videos to process (20-100, recommended: 40)

#### Advanced Settings
- **Processing Mode**: 
  - Fast Mode: Quick transcription only (3-6s per video)
  - Marketing Analysis: Full analysis with word-level categorization (35-40s per video)
- **Generate Synthetic Data**: Create additional AI-generated training examples
- **Synthetic Script Count**: Number of synthetic examples to generate (5-20)
- **Export Format**: JSONL (for Gemini) or JSON (general purpose)

### Expected Processing Times

- **Fast Mode**: ~5-10 minutes for 40 videos
- **Marketing Analysis**: ~25-30 minutes for 40 videos
- **With Synthetic Data**: Add 5-10 minutes for template generation

## 🎯 Output

The pipeline produces:

### Training Dataset
- **JSONL Format**: Ready for Gemini fine-tuning
- **JSON Format**: General-purpose training data
- **Comprehensive Examples**: Original + synthetic content

### Metadata
- **Performance Metrics**: View counts, engagement data
- **Processing Statistics**: Success rates, timing data
- **Template Analysis**: Generated content patterns
- **Quality Metrics**: Validation and verification results

### Google Drive Integration
- **Organized Storage**: Timestamped folders with all data
- **Complete Archives**: Raw extractions, transcriptions, analysis
- **Backup Copies**: Redundant storage for data safety

## 🔧 API Usage

You can also use the pipeline programmatically:

```bash
curl -X POST http://localhost:3000/api/automated-pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "username": "creator_username",
    "platform": "tiktok",
    "videoCount": 40,
    "options": {
      "fastMode": false,
      "generateSyntheticData": true,
      "syntheticScriptCount": 10,
      "exportFormat": "jsonl"
    }
  }'
```

### Response Format

```json
{
  "success": true,
  "data": {
    "pipeline": {
      "username": "creator_username",
      "platform": "tiktok",
      "videoCount": 40,
      "processingMode": "marketing_analysis",
      "completedAt": "2024-01-15T10:30:00Z"
    },
    "extraction": {
      "totalVideos": 40,
      "googleDrive": { ... }
    },
    "transcription": {
      "successful": 38,
      "failed": 2,
      "processingTime": 1800000
    },
    "templates": {
      "generated": 15
    },
    "synthetic": {
      "generated": 10
    },
    "trainingData": {
      "format": "jsonl",
      "totalExamples": 156,
      "downloadUrl": "https://..."
    }
  }
}
```

## 📊 Performance Optimization

### Recommended Settings

**For Fine-Tuning (Recommended)**:
- Video Count: 40
- Processing Mode: Marketing Analysis
- Generate Synthetic Data: Yes
- Synthetic Scripts: 10
- Export Format: JSONL

**For Quick Testing**:
- Video Count: 20
- Processing Mode: Fast
- Generate Synthetic Data: No
- Export Format: JSON

**For Maximum Dataset**:
- Video Count: 60-100
- Processing Mode: Marketing Analysis
- Generate Synthetic Data: Yes
- Synthetic Scripts: 20
- Export Format: JSONL

### Rate Limiting

The pipeline automatically handles rate limiting:
- **RapidAPI**: Respects social media API limits
- **Gemini API**: Intelligent delays between requests
- **Google Drive**: Batch operations for efficiency

## 🛠️ Troubleshooting

### Common Issues

**"No videos extracted"**
- Check username spelling and platform
- Ensure profile is public
- Try different creator with more content

**"Transcription failed"**
- Check Gemini API key configuration
- Verify API quota availability
- Try fast mode for quicker processing

**"Export failed"**
- Check Google Drive permissions
- Verify storage quota
- Try smaller dataset size

### Error Recovery

The pipeline includes comprehensive error handling:
- Individual video failures don't stop the process
- Partial results are saved and available
- Detailed error logs help identify issues
- Graceful degradation when services are unavailable

## 🔑 Prerequisites

Ensure you have configured:
- `GEMINI_API_KEY` - For content analysis
- `RAPIDAPI_KEY` - For social media extraction
- Google Drive credentials - For storage
- All environment variables from `.env.example`

## 🎉 Success Metrics

A successful pipeline run typically produces:
- **90%+ success rate** for video processing
- **10-20 templates** from successful content
- **100+ training examples** for fine-tuning
- **Complete metadata** for analysis and optimization

The automated pipeline transforms hours of manual work into a single-click process, making it easy to create high-quality training datasets for content generation models. 