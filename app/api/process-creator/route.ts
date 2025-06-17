import { NextResponse } from "next/server";
import { 
  createFolder, 
  uploadTextFile, 
  generateCreatorFolderName,
  testGoogleDriveConnection,
  type DriveUploadResult 
} from "@/lib/google-drive";

// Types for better error handling and response structure
interface RapidAPIError {
  message?: string;
  status?: number;
  code?: string;
}

interface ProcessCreatorRequest {
  username: string;
  platform: "tiktok" | "instagram";
  videoCount?: number; // Number of videos to extract (10-100)
  maxId?: string; // For pagination continuation
}

interface ProcessCreatorResponse {
  success: boolean;
  platform: string;
  username: string;
  data?: any;
  error?: string;
  pagination?: {
    hasMore: boolean;
    maxId?: string;
    totalRequested: number;
    totalExtracted: number;
  };
  extractedVideos?: Array<{
    id: string;
    video_url?: string;
    thumbnail?: string;
    is_video: boolean;
    platform: string;
    fileSize?: number;
    quality?: string;
    viewCount?: number; // Added view count for sorting
    likeCount?: number; // Additional engagement metrics
  }>;
  googleDrive?: {
    folderId: string;
    folderName: string;
    metadataFileId?: string;
    folderUrl: string;
  };
}

// Helper function for making RapidAPI calls with comprehensive error handling
async function fetchFromRapidAPI(url: string, host: string): Promise<any> {
  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
      'x-rapidapi-host': host,
    },
  };

  console.log(`Making RapidAPI request to: ${url}`);
  console.log(`Host: ${host}`);
  
  try {
    const response = await fetch(url, options);
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      let errorMessage = `API call failed with status: ${response.status}`;
      
      try {
        const errorData = await response.json();
        console.log("Error response data:", errorData);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (parseError) {
        console.log("Could not parse error response as JSON");
        const textResponse = await response.text();
        console.log("Error response text:", textResponse);
        errorMessage = textResponse || errorMessage;
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log("Successful API response received");
    console.log("Response data keys:", Object.keys(data));
    
    return data;
    
  } catch (error: any) {
    console.error("RapidAPI Error Details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
      url: url,
      host: host
    });
    
    // Re-throw with more context
    throw new Error(`RapidAPI request failed: ${error.message}`);
  }
}

// Helper function to validate environment variables
function validateEnvironment(): string | null {
  if (!process.env.RAPIDAPI_KEY) {
    return "RAPIDAPI_KEY environment variable is not set";
  }
  
  if (process.env.RAPIDAPI_KEY.length < 20) {
    return "RAPIDAPI_KEY appears to be invalid (too short)";
  }
  
  return null;
}

// Helper function to validate username
function validateUsername(username: string): string | null {
  if (!username || username.trim().length === 0) {
    return "Username cannot be empty";
  }
  
  if (username.length > 50) {
    return "Username is too long (max 50 characters)";
  }
  
  // Remove @ symbol if present
  const cleanUsername = username.replace('@', '');
  
  if (!/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
    return "Username contains invalid characters";
  }
  
  return null;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    console.log("=== Processing Creator Request ===");
    
    // Validate environment
    const envError = validateEnvironment();
    if (envError) {
      console.error("Environment validation failed:", envError);
      return NextResponse.json(
        { 
          success: false,
          error: envError 
        },
        { status: 500 }
      );
    }
    
    // Parse request body
    let requestData: ProcessCreatorRequest;
    try {
      requestData = await req.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json(
        { 
          success: false,
          error: "Invalid request body" 
        },
        { status: 400 }
      );
    }
    
    const { username, platform, videoCount = 40, maxId } = requestData;
    
    console.log("Request details:", { username, platform, videoCount, maxId });
    
    // Validate required fields
    if (!username || !platform) {
      return NextResponse.json(
        { 
          success: false,
          error: "Username and platform are required" 
        },
        { status: 400 }
      );
    }
    
    // Validate video count
    if (videoCount < 10 || videoCount > 100 || videoCount % 10 !== 0) {
      return NextResponse.json(
        { 
          success: false,
          error: "Video count must be between 10-100 in increments of 10" 
        },
        { status: 400 }
      );
    }
    
    // Validate username
    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json(
        { 
          success: false,
          error: usernameError 
        },
        { status: 400 }
      );
    }
    
    // Validate platform
    if (!["tiktok", "instagram"].includes(platform)) {
      return NextResponse.json(
        { 
          success: false,
          error: "Platform must be 'tiktok' or 'instagram'" 
        },
        { status: 400 }
      );
    }
    
    const cleanUsername = username.replace('@', '').trim();
    let allExtractedVideos: Array<{
      id: string;
      video_url?: string;
      thumbnail?: string;
      is_video: boolean;
      platform: string;
      fileSize?: number;
      quality?: string;
      viewCount?: number; // Added view count for sorting
      likeCount?: number; // Additional engagement metrics
    }> = [];
    
    let paginationInfo: { hasMore: boolean; maxId?: string; totalRequested: number; totalExtracted: number } = { 
      hasMore: false, 
      totalRequested: videoCount,
      totalExtracted: 0
    };
    
    let currentMaxId = maxId;
    let apiCallCount = 0;
    // Collect more videos than requested so we can sort by view count and select best performers
    const targetCollectionCount = Math.min(videoCount * 2, 200); // Collect 2x requested or max 200
    const maxApiCalls = Math.max(Math.ceil(targetCollectionCount / 10), 10); // At least 10 API calls, more if needed
    
    console.log(`Target: ${videoCount} best performing videos, Collection target: ${targetCollectionCount}, Max API calls: ${maxApiCalls}`);
    
    // --- PLATFORM-SPECIFIC API CALLS WITH PAGINATION ---
    if (platform === 'tiktok') {
      console.log(`Fetching TikTok feed for: ${cleanUsername}`);
      
      while (allExtractedVideos.length < targetCollectionCount && apiCallCount < maxApiCalls) {
        apiCallCount++;
        console.log(`TikTok API Call ${apiCallCount}/${maxApiCalls}, Current videos: ${allExtractedVideos.length}/${targetCollectionCount}`);
        
        // Construct URL with pagination if maxId is provided
        let url = `https://tiktok-scrapper-videos-music-challenges-downloader.p.rapidapi.com/user/${cleanUsername}/feed`;
        if (currentMaxId) {
          url += `?max_cursor=${currentMaxId}`;
        }
        
        const host = 'tiktok-scrapper-videos-music-challenges-downloader.p.rapidapi.com';
        const apiResponse = await fetchFromRapidAPI(url, host);
        
        // Log the complete TikTok API response
        console.log(`=== TIKTOK API CALL ${apiCallCount} RESPONSE JSON ===`);
        console.log(JSON.stringify(apiResponse, null, 2));
        console.log('=== END TIKTOK RESPONSE ===');
        
        // Extract videos from this API call
        const awemeList = apiResponse?.data?.aweme_list || apiResponse?.aweme_list || [];
        console.log(`TikTok API Call ${apiCallCount}: Found ${awemeList.length} videos to process`);
        
        // Debug: Log structure of first video and pagination info
        if (awemeList.length > 0) {
          console.log("=== TIKTOK FIRST VIDEO STRUCTURE DEBUG ===");
          const firstVideo = awemeList[0];
          console.log("Available fields:", Object.keys(firstVideo));
          console.log("Stats object:", firstVideo.stats);
          console.log("Statistics object:", firstVideo.statistics);
          console.log("=== END TIKTOK STRUCTURE DEBUG ===");
        }
        
        // Debug: Log pagination info from API response
        console.log("=== TIKTOK PAGINATION DEBUG ===");
        console.log("API Response keys:", Object.keys(apiResponse));
        console.log("has_more:", apiResponse.has_more);
        console.log("hasMore:", apiResponse.hasMore);
        console.log("max_cursor:", apiResponse.max_cursor);
        console.log("maxCursor:", apiResponse.maxCursor);
        console.log("=== END TIKTOK PAGINATION DEBUG ===");
        
        const batchVideos = awemeList.map((aweme: any, index: number) => {
          // Find smallest bitrate video for transcription
          const bitrates = aweme.video?.bit_rate || [];
          const smallestBitrate = bitrates.sort((a: any, b: any) => 
            (a.bit_rate || 0) - (b.bit_rate || 0)
          )[0];
          
          const videoUrl = smallestBitrate?.play_addr?.url_list?.[0] || 
                          aweme.video?.play_addr?.url_list?.[0] ||
                          aweme.video?.download_addr?.url_list?.[0];
          
          const thumbnailUrl = aweme.video?.cover?.url_list?.[0] ||
                              aweme.video?.dynamic_cover?.url_list?.[0];
          
          // Extract view count and engagement data
          const viewCount = aweme.statistics?.play_count || aweme.stats?.play_count || 0;
          const likeCount = aweme.statistics?.digg_count || aweme.stats?.digg_count || 0;
          
          console.log(`TikTok Video ${allExtractedVideos.length + index + 1}:`, {
            id: aweme.aweme_id,
            video_url: videoUrl,
            thumbnail: thumbnailUrl,
            bitrate: smallestBitrate?.bit_rate,
            quality: smallestBitrate?.quality,
            play_count: viewCount,
            digg_count: likeCount,
            stats_available: !!aweme.statistics || !!aweme.stats
          });
          
                      return {
              id: aweme.aweme_id || `tiktok_${allExtractedVideos.length + index}`,
              video_url: videoUrl,
              thumbnail: thumbnailUrl,
              is_video: true,
              platform: 'tiktok',
              quality: smallestBitrate?.quality || 'unknown',
              fileSize: smallestBitrate?.bit_rate,
              viewCount: viewCount,
              likeCount: likeCount
            };
        }).filter((video: any) => {
          // Only include videos with valid URLs that look like actual video URLs
          if (!video.video_url) return false;
          
          // Basic URL validation
          try {
            const url = new URL(video.video_url);
            // Check if URL looks like a TikTok video URL
            const isValidTikTokUrl = url.hostname.includes('tiktokcdn') || 
                                   url.hostname.includes('tiktok') ||
                                   url.pathname.includes('.mp4') ||
                                   url.searchParams.has('mime_type');
            
            if (!isValidTikTokUrl) {
              console.warn(`Filtering out invalid TikTok URL: ${video.video_url.substring(0, 100)}...`);
              return false;
            }
            
            return true;
          } catch (urlError) {
            console.warn(`Filtering out malformed URL: ${video.video_url.substring(0, 100)}...`);
            return false;
          }
        });
        
        // Add to our collection, but don't exceed the target collection count
        const remainingSlots = targetCollectionCount - allExtractedVideos.length;
        const videosToAdd = batchVideos.slice(0, remainingSlots);
        allExtractedVideos.push(...videosToAdd);
        
        console.log(`Added ${videosToAdd.length} videos, Total: ${allExtractedVideos.length}/${targetCollectionCount}`);
        
        // Check for pagination info - be more aggressive about collecting videos
        const hasMoreFromAPI = apiResponse && (apiResponse.has_more || apiResponse.hasMore);
        const gotVideosThisCall = batchVideos.length > 0;
        const maxCursor = apiResponse?.max_cursor || apiResponse?.maxCursor;
        
        // Continue if: API says more available, OR we got videos and have cursor, OR we haven't tried enough calls yet
        const shouldContinue = hasMoreFromAPI || 
                              (gotVideosThisCall && maxCursor && allExtractedVideos.length < targetCollectionCount) ||
                              (gotVideosThisCall && apiCallCount < 5 && allExtractedVideos.length < targetCollectionCount);
        
        if (shouldContinue) {
          // Use provided cursor, or generate a simple incremental one if none provided
          currentMaxId = maxCursor || (currentMaxId ? `${parseInt(currentMaxId) + 1}` : "1");
          paginationInfo.hasMore = allExtractedVideos.length >= targetCollectionCount ? false : true;
          paginationInfo.maxId = currentMaxId;
          console.log(`TikTok pagination: hasMoreFromAPI=${hasMoreFromAPI}, gotVideos=${gotVideosThisCall}, maxCursor=${!!maxCursor}, willContinue=true`);
        } else {
          // No more data available or no cursor for next page
          paginationInfo.hasMore = false;
          console.log("TikTok pagination: No more data available, stopping pagination");
          break;
        }
        
        // If we have enough videos for sorting, stop
        if (allExtractedVideos.length >= targetCollectionCount) {
          break;
        }
        
        // Add delay between API calls to respect rate limits
        if (apiCallCount < maxApiCalls && allExtractedVideos.length < targetCollectionCount) {
          console.log("Waiting 1 second before next TikTok API call...");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
    } else if (platform === 'instagram') {
      console.log(`Processing Instagram request for: ${cleanUsername}`);
      
      // STEP 1: Get User ID from username (only needed once)
      console.log("Step 1: Getting Instagram User ID");
      const userIdUrl = `https://instagram-scrapper-posts-reels-stories-downloader.p.rapidapi.com/user_id_by_username?username=${cleanUsername}`;
      const host = 'instagram-scrapper-posts-reels-stories-downloader.p.rapidapi.com';
      
      const userIdResponse = await fetchFromRapidAPI(userIdUrl, host);
      
      // Log the Instagram User ID API response
      console.log('=== INSTAGRAM USER ID API RESPONSE JSON ===');
      console.log(JSON.stringify(userIdResponse, null, 2));
      console.log('=== END INSTAGRAM USER ID RESPONSE ===');
      
      const userId = userIdResponse.UserID || userIdResponse.user_id;
      if (!userId) {
        throw new Error('Could not retrieve Instagram User ID from username');
      }
      
      console.log(`Step 1 Complete: Retrieved Instagram User ID: ${userId}`);
      
      // Add delay to avoid per-second rate limiting
      console.log("Waiting 1 second to avoid rate limiting...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // STEP 2: Get Post Feed from User ID with pagination
      while (allExtractedVideos.length < targetCollectionCount && apiCallCount < maxApiCalls) {
        apiCallCount++;
        console.log(`Instagram API Call ${apiCallCount}/${maxApiCalls}, Current videos: ${allExtractedVideos.length}/${targetCollectionCount}`);
        
        let postFeedUrl = `https://instagram-scrapper-posts-reels-stories-downloader.p.rapidapi.com/posts_by_user_id?user_id=${userId}`;
        
        // Add pagination if maxId is provided
        if (currentMaxId) {
          postFeedUrl += `&next_max_id=${currentMaxId}`;
        }
        
        const apiResponse = await fetchFromRapidAPI(postFeedUrl, host);
        
        // Log the complete Instagram Posts API response
        console.log(`=== INSTAGRAM POSTS API CALL ${apiCallCount} RESPONSE JSON ===`);
        console.log(JSON.stringify(apiResponse, null, 2));
        console.log('=== END INSTAGRAM POSTS RESPONSE ===');
        
        // Extract videos from this API call
        const items = apiResponse?.items || [];
        console.log(`Instagram API Call ${apiCallCount}: Found ${items.length} items to process`);
        
        // Debug: Log structure of first item to understand play_count location
        if (items.length > 0) {
          console.log("=== INSTAGRAM FIRST ITEM STRUCTURE DEBUG ===");
          const firstItem = items[0];
          console.log("Item available fields:", Object.keys(firstItem));
          console.log("Item play_count:", firstItem.play_count);
          console.log("Item view_count:", firstItem.view_count);
          console.log("Item like_count:", firstItem.like_count);
          if (firstItem.carousel_media && firstItem.carousel_media.length > 0) {
            console.log("Carousel media fields:", Object.keys(firstItem.carousel_media[0]));
            console.log("Carousel media play_count:", firstItem.carousel_media[0].play_count);
          }
          console.log("=== END INSTAGRAM STRUCTURE DEBUG ===");
        }
        
        const batchVideos = items.map((item: any, index: number) => {
          // Handle carousel media (multiple videos/images) or single media
          const media = item.carousel_media || [item];
          
          return media.map((m: any, mediaIndex: number) => {
            const videos = m.video_versions || [];
            const images = m.image_versions2?.candidates || [];
            
            // Find smallest video version for transcription
            const smallestVideo = videos.sort((a: any, b: any) => 
              (a.width || 0) - (b.width || 0)
            )[0];
            
            // Find smallest image/thumbnail
            const smallestImage = images.sort((a: any, b: any) => 
              (a.width || 0) - (b.width || 0)
            )[0];
            
            const isVideo = m.media_type === 2;
            
            // Extract view count and engagement data - check multiple possible field locations
            const viewCount = item.play_count || m.play_count || item.view_count || m.view_count || 0;
            const likeCount = item.like_count || m.like_count || 0;
            
            console.log(`Instagram Item ${allExtractedVideos.length + index + 1}.${mediaIndex + 1}:`, {
              id: m.id,
              video_url: smallestVideo?.url,
              thumbnail: smallestImage?.url,
              is_video: isVideo,
              video_width: smallestVideo?.width,
              video_height: smallestVideo?.height,
              play_count: viewCount,
              like_count: likeCount,
              item_has_play_count: !!item.play_count,
              media_has_play_count: !!m.play_count
            });
            
            return {
              id: m.id || `instagram_${allExtractedVideos.length + index}_${mediaIndex}`,
              video_url: smallestVideo?.url,
              thumbnail: smallestImage?.url,
              is_video: isVideo,
              platform: 'instagram',
              quality: `${smallestVideo?.width || 0}x${smallestVideo?.height || 0}`,
              fileSize: smallestVideo?.width || 0,
              viewCount: viewCount,
              likeCount: likeCount
            };
          });
        }).flat().filter((video: any) => {
          // Only include videos with valid URLs that look like actual video URLs
          if (!video.is_video || !video.video_url) return false;
          
          // Basic URL validation for Instagram
          try {
            const url = new URL(video.video_url);
            // Check if URL looks like an Instagram video URL
            const isValidInstagramUrl = url.hostname.includes('cdninstagram') || 
                                      url.hostname.includes('instagram') ||
                                      url.hostname.includes('fbcdn') ||
                                      url.pathname.includes('.mp4');
            
            if (!isValidInstagramUrl) {
              console.warn(`Filtering out invalid Instagram URL: ${video.video_url.substring(0, 100)}...`);
              return false;
            }
            
            return true;
          } catch (urlError) {
            console.warn(`Filtering out malformed Instagram URL: ${video.video_url.substring(0, 100)}...`);
            return false;
          }
        });
        
        // Add to our collection, but don't exceed the target collection count
        const remainingSlots = targetCollectionCount - allExtractedVideos.length;
        const videosToAdd = batchVideos.slice(0, remainingSlots);
        allExtractedVideos.push(...videosToAdd);
        
        console.log(`Added ${videosToAdd.length} videos, Total: ${allExtractedVideos.length}/${targetCollectionCount}`);
        
        // Check for pagination info
        if (apiResponse && apiResponse.more_available) {
          currentMaxId = apiResponse.next_max_id;
          paginationInfo.hasMore = allExtractedVideos.length >= targetCollectionCount ? false : true;
          paginationInfo.maxId = currentMaxId;
        } else {
          // No more data available
          paginationInfo.hasMore = false;
          break;
        }
        
        // If we have enough videos for sorting, stop
        if (allExtractedVideos.length >= targetCollectionCount) {
          break;
        }
        
        // Add delay between API calls to respect rate limits
        if (apiCallCount < maxApiCalls && allExtractedVideos.length < targetCollectionCount) {
          console.log("Waiting 1 second before next Instagram API call...");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    paginationInfo.totalExtracted = allExtractedVideos.length;
    
    // Sort videos by view count to get best performing content
    console.log(`Sorting ${allExtractedVideos.length} videos by view count...`);
    allExtractedVideos.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    
    // Take only the requested number of top performing videos
    if (allExtractedVideos.length > videoCount) {
      console.log(`Selecting top ${videoCount} performing videos from ${allExtractedVideos.length} total`);
      allExtractedVideos = allExtractedVideos.slice(0, videoCount);
      paginationInfo.totalExtracted = allExtractedVideos.length;
    }
    
    console.log(`Pagination Summary:`, {
      requested: paginationInfo.totalRequested,
      extracted: paginationInfo.totalExtracted,
      hasMore: paginationInfo.hasMore,
      maxId: paginationInfo.maxId,
      apiCalls: apiCallCount
    });
    
    // --- GOOGLE DRIVE INTEGRATION ---
    console.log("Starting Google Drive integration...");
    
    let googleDriveInfo;
    try {
      // Test Google Drive connection first
      const connectionTest = await testGoogleDriveConnection();
      if (!connectionTest.success) {
        console.warn("Google Drive connection failed, skipping upload:", connectionTest.error);
      } else {
        console.log("Google Drive connection successful, proceeding with upload");
        
        // Create unique folder for this creator/request
        const folderName = generateCreatorFolderName(platform, cleanUsername);
        const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID!;
        
        const folder = await createFolder(folderName, parentFolderId);
        
        if (folder.id) {
          // Create metadata file with API response
          const metadata = {
            platform,
            username: cleanUsername,
            requestTime: new Date().toISOString(),
            pagination: paginationInfo,
            extractedVideos: allExtractedVideos,
            videoCount: allExtractedVideos.length,
            requestedCount: videoCount,
            apiCallsMade: apiCallCount,
            processingDuration: Date.now() - startTime,
          };
          
          const metadataFileName = `${platform}_${cleanUsername}_${videoCount}videos_metadata.json`;
          const metadataFile = await uploadTextFile(
            JSON.stringify(metadata, null, 2),
            metadataFileName,
            folder.id,
            'application/json'
          );
          
          googleDriveInfo = {
            folderId: folder.id,
            folderName,
            metadataFileId: metadataFile.id || undefined,
            folderUrl: `https://drive.google.com/drive/folders/${folder.id}`,
          };
          
          console.log("Google Drive upload successful:", googleDriveInfo);
        }
      }
    } catch (driveError: any) {
      console.error("Google Drive integration failed:", driveError);
      // Don't fail the entire request if Google Drive fails
      console.log("Continuing without Google Drive upload...");
    }
    
    console.log(`Successfully extracted ${allExtractedVideos.length} videos for transcription`);
    
    // Log extracted video summary with full URLs and performance metrics
    console.log("=== EXTRACTED VIDEOS SUMMARY WITH PERFORMANCE METRICS ===");
    allExtractedVideos.forEach((video, index) => {
      console.log(`Video ${index + 1} (sorted by view count):`, {
        id: video.id,
        platform: video.platform,
        has_video_url: !!video.video_url,
        has_thumbnail: !!video.thumbnail,
        quality: video.quality,
        viewCount: video.viewCount,
        likeCount: video.likeCount
      });
      console.log(`Video ${index + 1} COMPLETE DOWNLOAD URL:`);
      console.log(video.video_url || 'NO URL AVAILABLE');
      console.log(`Video ${index + 1} THUMBNAIL URL:`);
      console.log(video.thumbnail || 'NO THUMBNAIL AVAILABLE');
      console.log('---');
    });
    console.log("=== END EXTRACTED VIDEOS ===");
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Request completed successfully in ${duration}ms`);
    console.log(`Final Stats: ${allExtractedVideos.length}/${videoCount} best performing videos selected from collection in ${apiCallCount} API calls`);
    
    // Log top 5 videos by view count for verification
    if (allExtractedVideos.length > 0) {
      console.log("=== TOP PERFORMING VIDEOS ===");
      allExtractedVideos.slice(0, 5).forEach((video, index) => {
        console.log(`#${index + 1}: ${video.viewCount?.toLocaleString() || 'N/A'} views, ${video.likeCount?.toLocaleString() || 'N/A'} likes`);
      });
    }
    
    console.log("=== Request Complete ===");
    
    const response: ProcessCreatorResponse = {
      success: true,
      platform,
      username: cleanUsername,
      pagination: paginationInfo,
      extractedVideos: allExtractedVideos,
      googleDrive: googleDriveInfo
    };
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error("=== Request Failed ===");
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
      duration: `${duration}ms`
    });
    
    // Determine appropriate status code based on error type
    let statusCode = 500;
    let errorMessage = "An internal server error occurred";
    
    if (error.message.includes("User ID")) {
      statusCode = 404;
      errorMessage = "Instagram user not found or username is invalid";
    } else if (error.message.includes("API call failed with status: 404")) {
      statusCode = 404;
      errorMessage = "User not found on the selected platform";
    } else if (error.message.includes("API call failed with status: 401")) {
      statusCode = 401;
      errorMessage = "API authentication failed - please check API key";
    } else if (error.message.includes("API call failed with status: 429")) {
      statusCode = 429;
      errorMessage = "Rate limit exceeded - please try again later";
    } else if (error.message.includes("RapidAPI request failed")) {
      errorMessage = error.message;
    }
    
    const response: ProcessCreatorResponse = {
      success: false,
      platform: "unknown",
      username: "unknown",
      error: errorMessage,
      pagination: {
        hasMore: false,
        totalRequested: 0,
        totalExtracted: 0
      }
    };
    
    return NextResponse.json(response, { status: statusCode });
  }
} 