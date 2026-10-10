import { NextRequest } from 'next/server';

export async function verifyAdminToken(idToken: string): Promise<{ authorized: boolean; uid?: string; error?: string }> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAn4MTUhIBPwh9n8pWiDipkUeg6UMQTt10";
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    
    if (!res.ok) {
      return { authorized: false, error: 'Invalid or expired Firebase authentication token' };
    }

    const data = await res.json();
    const user = data.users?.[0];
    if (!user) {
      return { authorized: false, error: 'User account not found' };
    }

    const uid = user.localId;
    let customAttributes: any = {};
    if (user.customAttributes) {
      try {
        customAttributes = JSON.parse(user.customAttributes);
      } catch (e) {}
    }

    // Check Layer 1: Auth Custom Claims
    if (customAttributes.admin === true) {
      return { authorized: true, uid };
    }

    // Check Layer 2: Cloud Firestore collection /admins/{uid}
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "playstore-d0ba0";
    const fsRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admins/${uid}`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });

    if (fsRes.ok) {
      const fsData = await fsRes.json();
      const fields = fsData.fields || {};
      const isAdmin = fields.admin?.booleanValue === true || fields.role?.stringValue === 'admin';
      if (isAdmin) {
        return { authorized: true, uid };
      }
    }

    return { authorized: false, error: 'Access Denied: Administrator privileges required' };
  } catch (err: any) {
    return { authorized: false, error: err.message || 'Authorization check failed' };
  }
}

export function extractBearerToken(req: NextRequest): string {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.replace(/^Bearer\s+/i, '').trim();
}
