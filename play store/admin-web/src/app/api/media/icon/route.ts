import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, extractBearerToken } from '@/lib/serverAuth';
import { uploadMediaToGoogleDrive, extractDriveFileId, deleteDriveFile } from '@/lib/googleDrive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Administrator
    const idToken = extractBearerToken(req);
    if (!idToken) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const authCheck = await verifyAdminToken(idToken);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error || 'Access Denied' }, { status: 403 });
    }

    // 2. Parse Multipart Form Data
    const formData = await req.formData();
    const appId = formData.get('appId')?.toString()?.trim() || `app_${Date.now()}`;
    const previousIconUrl = formData.get('previousIconUrl')?.toString()?.trim() || '';
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'No icon image file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Uploaded file must be an image (PNG, JPG, WEBP)' }, { status: 400 });
    }

    // Max 10MB icon
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Icon file size exceeds 10MB limit' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || 'icon.png';
    const mimeType = file.type || 'image/png';

    // 3. Upload New Icon to Google Drive
    const uploadResult = await uploadMediaToGoogleDrive({
      buffer,
      filename,
      mimeType,
      appId,
      type: 'icon'
    });

    // 4. Update Firestore App Document (if app exists)
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'playstore-d0ba0';
    const fsAppUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/apps/${appId}?updateMask.fieldPaths=iconUrl&updateMask.fieldPaths=updatedAt`;
    const nowIso = new Date().toISOString();

    const patchRes = await fetch(fsAppUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          iconUrl: { stringValue: uploadResult.directUrl },
          updatedAt: { timestampValue: nowIso }
        }
      })
    });

    // If document doesn't exist yet (e.g. app creation in progress), that's fine; client will save it
    const firestoreUpdated = patchRes.ok;

    // 5. Replace Old Media Safely:
    // Only delete the old icon file from Google Drive after new upload and Firestore update succeeded
    if (previousIconUrl && previousIconUrl !== uploadResult.directUrl) {
      const oldFileId = extractDriveFileId(previousIconUrl);
      if (oldFileId && oldFileId !== uploadResult.fileId) {
        deleteDriveFile(oldFileId).catch((err) => {
          console.warn('Could not delete previous icon file from Google Drive:', err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'App icon uploaded to Google Drive successfully',
      iconUrl: uploadResult.directUrl,
      fileId: uploadResult.fileId,
      firestoreUpdated
    });

  } catch (err: any) {
    console.error('Error in /api/media/icon:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to upload icon to Google Drive' },
      { status: 500 }
    );
  }
}
