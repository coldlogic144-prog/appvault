import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, extractBearerToken } from '@/lib/serverAuth';
import { deleteDriveFile, extractDriveFileId } from '@/lib/googleDrive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const authCheck = await verifyAdminToken(idToken);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error || 'Access Denied' }, { status: 403 });
    }

    const body = await req.json();
    const url = body.url?.toString()?.trim() || '';
    let fileId = body.fileId?.toString()?.trim() || '';

    if (!fileId && url) {
      fileId = extractDriveFileId(url) || '';
    }

    if (!fileId) {
      return NextResponse.json({ error: 'Valid fileId or Google Drive URL is required' }, { status: 400 });
    }

    const deleted = await deleteDriveFile(fileId);

    return NextResponse.json({
      success: deleted,
      message: deleted ? 'File deleted from Google Drive' : 'File could not be found or was already deleted'
    });

  } catch (err: any) {
    console.error('Error in /api/media/delete:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete file from Google Drive' }, { status: 500 });
  }
}
