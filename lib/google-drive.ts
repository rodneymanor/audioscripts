import { google } from 'googleapis';
import { Readable } from 'stream';

// Initialize Google Drive client
export function getGoogleDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });
  return drive;
}

// Create a folder in Google Drive
export async function createFolder(name: string, parentFolderId?: string) {
  const drive = getGoogleDriveClient();
  
  console.log(`Creating Google Drive folder: ${name}`);
  
  try {
    // First try with parent folder if provided
    if (parentFolderId) {
      try {
        const response = await drive.files.create({
          requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
          },
        });

        console.log(`Folder created successfully with parent: ${response.data.id}`);
        return response.data;
      } catch (parentError: any) {
        console.warn(`Failed to create folder with parent ${parentFolderId}, trying root folder:`, parentError.message);
        // Fall through to create in root
      }
    }

    // Create in root folder if parent fails or not provided
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        // No parents specified = root folder
      },
    });

    console.log(`Folder created successfully in root: ${response.data.id}`);
    return response.data;
  } catch (error: any) {
    console.error('Error creating folder:', error);
    throw new Error(`Failed to create folder: ${error.message}`);
  }
}

// Upload a file to Google Drive from URL
export async function uploadFileFromUrl(
  url: string,
  fileName: string,
  folderId: string,
  mimeType?: string
) {
  const drive = getGoogleDriveClient();
  
  console.log(`Downloading file from URL: ${url}`);
  
  try {
    // Download the file from URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    // Convert response to readable stream
    const buffer = await response.arrayBuffer();
    const stream = Readable.from(Buffer.from(buffer));

    console.log(`Uploading file to Google Drive: ${fileName}`);
    
    // Upload to Google Drive
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: mimeType || 'application/octet-stream',
        body: stream,
      },
    });

    console.log(`File uploaded successfully: ${uploadResponse.data.id}`);
    return uploadResponse.data;
  } catch (error: any) {
    console.error('Error uploading file:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

// Upload text data as a file
export async function uploadTextFile(
  content: string,
  fileName: string,
  folderId: string,
  mimeType: string = 'text/plain'
) {
  const drive = getGoogleDriveClient();
  
  console.log(`Uploading text file to Google Drive: ${fileName}`);
  
  try {
    const stream = Readable.from(Buffer.from(content, 'utf-8'));
    
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: stream,
      },
    });

    console.log(`Text file uploaded successfully: ${response.data.id}`);
    return response.data;
  } catch (error: any) {
    console.error('Error uploading text file:', error);
    throw new Error(`Failed to upload text file: ${error.message}`);
  }
}

// Test Google Drive connection
export async function testGoogleDriveConnection() {
  const drive = getGoogleDriveClient();
  
  try {
    console.log('Testing Google Drive connection...');
    
    // Try to get info about the parent folder
    const response = await drive.files.get({
      fileId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID!,
      fields: 'id, name, mimeType',
    });

    console.log('Google Drive connection successful');
    console.log('Parent folder info:', response.data);
    
    return {
      success: true,
      folderInfo: response.data,
    };
  } catch (error: any) {
    console.error('Google Drive connection failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Generate unique folder name for a creator
export function generateCreatorFolderName(platform: string, username: string): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  return `${platform}_${username}_${timestamp}`;
}

export interface DriveUploadResult {
  folderId: string;
  folderName: string;
  uploadedFiles: Array<{
    fileName: string;
    fileId: string;
    url?: string;
  }>;
  metadataFile?: {
    fileName: string;
    fileId: string;
  };
}

// Upload multiple files to Google Drive
export async function uploadToGoogleDrive(
  files: Array<{
    name: string;
    content: string;
    mimeType: string;
  }>,
  folderName: string
): Promise<{
  folderUrl: string;
  files: Array<{
    name: string;
    url: string;
    content?: string;
  }>;
}> {
  const drive = getGoogleDriveClient();
  
  console.log(`Creating folder and uploading ${files.length} files to Google Drive`);
  
  try {
    // Create folder
    const folder = await createFolder(folderName, process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID);
    const folderId = folder.id!;
    
    // Upload all files
    const uploadedFiles = [];
    
    for (const file of files) {
      const stream = Readable.from(Buffer.from(file.content, 'utf-8'));
      
      const response = await drive.files.create({
        requestBody: {
          name: file.name,
          parents: [folderId],
        },
        media: {
          mimeType: file.mimeType,
          body: stream,
        },
      });
      
      // Make file publicly viewable
      await drive.permissions.create({
        fileId: response.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
      
      uploadedFiles.push({
        name: file.name,
        url: `https://drive.google.com/file/d/${response.data.id}/view`,
        content: file.content
      });
      
      console.log(`Uploaded: ${file.name}`);
    }
    
    // Make folder publicly viewable
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
    
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
    
    console.log(`All files uploaded successfully to folder: ${folderUrl}`);
    
    return {
      folderUrl,
      files: uploadedFiles
    };
    
  } catch (error: any) {
    console.error('Error uploading to Google Drive:', error);
    throw new Error(`Failed to upload to Google Drive: ${error.message}`);
  }
} 