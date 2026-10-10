/**
 * AppVault Server-side Google Drive Media Storage Service
 * Handles OAuth2 token refresh, folder hierarchy management,
 * multipart file uploads, permissions, and direct image serving URLs.
 */

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Retrieves a valid Google OAuth2 access token using the server-side refresh token.
 */
export async function getGoogleDriveAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    const missing: string[] = [];
    if (!clientId) missing.push('GOOGLE_CLIENT_ID');
    if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
    if (!refreshToken) missing.push('GOOGLE_REFRESH_TOKEN');
    throw new Error(
      `Google Drive OAuth2 configuration missing: ${missing.join(', ')}. Please configure these variables in admin-web/.env.local.`
    );
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google OAuth2 token refresh failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Google OAuth2 did not return an access token.');
  }

  cachedAccessToken = data.access_token;
  const expiresIn = data.expires_in || 3600;
  tokenExpiresAt = Date.now() + expiresIn * 1000;
  return cachedAccessToken!;
}

/**
 * Searches for an existing folder or creates it if not found.
 */
export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const token = await getGoogleDriveAccessToken();

  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Drive folder "${name}": ${errText}`);
  }

  const newFolder = await createRes.json();
  return newFolder.id;
}

/**
 * Resolves the target app folder under:
 * AppVault/
 *   ├── icons/{appId}/
 *   └── screenshots/{appId}/
 */
export async function getAppMediaFolder(appId: string, type: 'icon' | 'screenshots'): Promise<string> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || (await findOrCreateFolder('AppVault'));
  const typeFolderId = await findOrCreateFolder(type === 'icon' ? 'icons' : 'screenshots', rootFolderId);
  const appFolderId = await findOrCreateFolder(appId, typeFolderId);
  return appFolderId;
}

/**
 * Uploads an image file to Google Drive under the designated app folder,
 * sets public read permissions, and returns a direct image serving URL.
 */
export async function uploadMediaToGoogleDrive({
  buffer,
  filename,
  mimeType,
  appId,
  type
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  appId: string;
  type: 'icon' | 'screenshots';
}): Promise<{ fileId: string; directUrl: string; filename: string }> {
  const token = await getGoogleDriveAccessToken();
  const parentFolderId = await getAppMediaFolder(appId, type);

  // Sanitized unique filename
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueFilename = `${type}_${Date.now()}_${cleanName}`;

  // Google Drive REST v3 Multipart Upload
  const boundary = `-------AppVaultMediaBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = JSON.stringify({
    name: uniqueFilename,
    parents: [parentFolderId]
  });

  const multipartBody = Buffer.concat([
    Buffer.from(
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}` +
      `${delimiter}Content-Type: ${mimeType}\r\n\r\n`
    ),
    buffer,
    Buffer.from(closeDelimiter)
  ]);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': multipartBody.length.toString()
      },
      body: multipartBody
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive media upload failed (${uploadRes.status}): ${errText}`);
  }

  const fileData = await uploadRes.json();
  const fileId = fileData.id;

  // Make file publicly readable for image loaders (anyone with link can view)
  const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone'
    })
  });

  if (!permRes.ok) {
    console.warn(`Warning: Could not set public permission on Google Drive file ${fileId}`);
  }

  // Construct direct media URL:
  // lh3.googleusercontent.com/d/{fileId} is Google's CDN endpoint for Drive files that returns
  // the raw image binary stream directly. Added cache-busting timestamp ?v= to bypass CDN/browser caching.
  const directUrl = `https://lh3.googleusercontent.com/d/${fileId}?v=${Date.now()}`;

  return { fileId, directUrl, filename: uniqueFilename };
}

/**
 * Extracts Google Drive file ID from various Drive URL formats.
 */
export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:lh3\.googleusercontent\.com\/d\/|drive\.google\.com\/file\/d\/|drive\.google\.com\/uc\?.*id=|drive\.google\.com\/thumbnail\?.*id=)([a-zA-Z0-9_-]+)/
  );
  return match ? match[1] : null;
}

/**
 * Deletes a file in Google Drive by file ID.
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  if (!fileId) return false;
  try {
    const token = await getGoogleDriveAccessToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.ok || res.status === 404;
  } catch (err) {
    console.warn(`Failed to delete Google Drive file ${fileId}:`, err);
    return false;
  }
}
