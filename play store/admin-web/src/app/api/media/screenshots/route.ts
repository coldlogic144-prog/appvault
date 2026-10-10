import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, extractBearerToken } from '@/lib/serverAuth';
import { uploadMediaToGoogleDrive } from '@/lib/googleDrive';

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
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No screenshot files provided' }, { status: 400 });
    }

    const uploadedUrls: string[] = [];

    // 3. Upload Each Screenshot to Google Drive in Sequence (preserving order)
    for (const file of files) {
      if (!(file instanceof File) || file.size === 0) continue;
      if (!file.type.startsWith('image/')) continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = file.name || 'screenshot.png';
      const mimeType = file.type || 'image/png';

      const result = await uploadMediaToGoogleDrive({
        buffer,
        filename,
        mimeType,
        appId,
        type: 'screenshots'
      });

      uploadedUrls.push(result.directUrl);
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json({ error: 'No valid screenshot images could be uploaded' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `${uploadedUrls.length} screenshot(s) uploaded to Google Drive successfully`,
      urls: uploadedUrls
    });

  } catch (err: any) {
    console.error('Error in /api/media/screenshots:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to upload screenshots to Google Drive' },
      { status: 500 }
    );
  }
}
