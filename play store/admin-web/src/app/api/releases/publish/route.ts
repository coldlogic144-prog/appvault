import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function verifyAdminToken(idToken: string): Promise<{ authorized: boolean; uid?: string; error?: string }> {
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

export async function POST(req: NextRequest) {
  try {
    // 1. Authorize Admin
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const authCheck = await verifyAdminToken(idToken);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error || 'Access Denied' }, { status: 403 });
    }

    // 2. Parse Multipart Form Data
    const formData = await req.formData();
    const appId = formData.get('appId')?.toString()?.trim();
    const versionName = formData.get('versionName')?.toString()?.trim();
    const versionCodeStr = formData.get('versionCode')?.toString()?.trim();
    const releaseTag = formData.get('releaseTag')?.toString()?.trim();
    const releaseNotes = formData.get('releaseNotes')?.toString()?.trim() || '';
    const changelog = formData.get('changelog')?.toString()?.trim() || releaseNotes;
    const minAndroidVersionStr = formData.get('minAndroidVersion')?.toString()?.trim() || '26';
    const reqGithubOwner = formData.get('githubOwner')?.toString()?.trim();
    const reqGithubRepo = formData.get('githubRepository')?.toString()?.trim();
    const apkFile = formData.get('apk') as File | null;

    if (!appId || !versionName || !versionCodeStr || !releaseTag) {
      return NextResponse.json({ error: 'Missing required version fields (appId, versionName, versionCode, releaseTag)' }, { status: 400 });
    }

    if (/\s/.test(releaseTag) || !/^[a-zA-Z0-9._-]+$/.test(releaseTag)) {
      return NextResponse.json({ 
        error: `Invalid release tag "${releaseTag}". Release tags must not contain spaces or special characters (allowed: a-z, A-Z, 0-9, ., _, -). Example: "v1.6.0"` 
      }, { status: 400 });
    }

    const versionCode = parseInt(versionCodeStr, 10);
    const minAndroidVersion = parseInt(minAndroidVersionStr, 10);

    if (isNaN(versionCode) || versionCode <= 0) {
      return NextResponse.json({ error: 'Version code must be a positive integer' }, { status: 400 });
    }

    // 3. Validate APK File
    if (!apkFile || !(apkFile instanceof File) || apkFile.size === 0) {
      return NextResponse.json({ error: 'Valid APK file is required' }, { status: 400 });
    }

    const rawFilename = apkFile.name || 'app-release.apk';
    if (!rawFilename.toLowerCase().endsWith('.apk')) {
      return NextResponse.json({ error: 'Uploaded file must have a .apk extension' }, { status: 400 });
    }

    const sanitizedFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const apkBuffer = Buffer.from(await apkFile.arrayBuffer());

    // 4. Resolve GitHub Repository Configuration
    const githubToken = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json({ 
        error: 'Server GitHub Personal Access Token (GITHUB_PAT) is not configured. Set GITHUB_PAT in environment variables.' 
      }, { status: 500 });
    }

    // Prioritize app-specific repository configured in form/Firestore, then fallback to environment defaults
    let owner = (reqGithubOwner || '').trim();
    let repo = (reqGithubRepo || '').trim();

    // If not provided in form, inspect app document in Firestore
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "playstore-d0ba0";
    if (!owner || !repo) {
      try {
        const appRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/apps/${appId}`, {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        if (appRes.ok) {
          const appDoc = await appRes.json();
          owner = owner || appDoc.fields?.githubOwner?.stringValue || '';
          repo = repo || appDoc.fields?.githubRepository?.stringValue || '';
        }
      } catch (e) {
        console.error('Error fetching app repository config:', e);
      }
    }

    // Fall back to server environment variables if still unconfigured
    owner = owner || (process.env.GITHUB_OWNER || '').trim();
    repo = repo || (process.env.GITHUB_REPO || '').trim();

    if (!owner || !repo) {
      return NextResponse.json({ 
        error: 'GitHub repository not specified. Please configure GitHub Owner and Repository for this application or set default GITHUB_OWNER and GITHUB_REPO in environment.' 
      }, { status: 400 });
    }

    // Standard GitHub API Headers (Using Bearer auth and 2022-11-28 version)
    const githubHeaders = {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'AppVault-Admin-Panel'
    };

    // 5. Pre-flight check: GET /repos/{owner}/{repo}
    const repoCheckUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const repoCheckRes = await fetch(repoCheckUrl, {
      method: 'GET',
      headers: githubHeaders
    });

    // Safe diagnostic logging (NEVER log the actual token)
    console.log('[GitHub Pre-flight Diagnostic]', {
      status: repoCheckRes.status,
      owner,
      repo,
      hasPAT: !!githubToken
    });

    if (!repoCheckRes.ok) {
      const status = repoCheckRes.status;
      // Inspect authenticated user login to give a precise diagnostic if 404
      let authUserLogin = '';
      try {
        const userRes = await fetch('https://api.github.com/user', {
          headers: githubHeaders
        });
        if (userRes.ok) {
          const uData = await userRes.json();
          authUserLogin = uData.login || '';
        }
      } catch (e) {}

      if (status === 404) {
        let hint = `GitHub repository check failed (404 Not Found): The PAT cannot access the repository or the repository configuration is wrong for "${owner}/${repo}".`;
        if (authUserLogin && authUserLogin !== owner) {
          hint += ` (Diagnostic: The configured GITHUB_PAT belongs to user "${authUserLogin}", not "${owner}". If your repository is "${authUserLogin}/${repo}", update GITHUB_OWNER=${authUserLogin} in .env.local).`;
        } else {
          hint += ` Verify that the repository "${owner}/${repo}" exists and that the GITHUB_PAT has 'repo' / push permissions to access it.`;
        }

        return NextResponse.json({
          error: hint,
          diagnostic: {
            status: 404,
            owner,
            repo,
            hasPAT: true,
            authenticatedUser: authUserLogin || 'unknown'
          }
        }, { status: 404 });
      }

      const errText = await repoCheckRes.text();
      return NextResponse.json({
        error: `GitHub repository check failed (${status}): ${errText}`,
        diagnostic: {
          status,
          owner,
          repo,
          hasPAT: true
        }
      }, { status: 502 });
    }

    // 6. Create or Retrieve GitHub Release
    let releaseData: any = null;
    const releaseCreateUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;

    const createRelRes = await fetch(releaseCreateUrl, {
      method: 'POST',
      headers: {
        ...githubHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tag_name: releaseTag,
        name: `${versionName} (${releaseTag})`,
        body: releaseNotes,
        draft: false,
        prerelease: false
      })
    });

    if (createRelRes.status === 201) {
      releaseData = await createRelRes.json();
    } else if (createRelRes.status === 422) {
      const errBody = await createRelRes.text();
      let errJson: any = null;
      try {
        errJson = JSON.parse(errBody);
      } catch (e) {}

      const isAlreadyExists = Array.isArray(errJson?.errors) && errJson.errors.some(
        (e: any) => e.code === 'already_exists' || (e.field === 'tag_name' && e.code === 'already_exists')
      );

      if (isAlreadyExists) {
        // Tag already exists on GitHub. First try fetching the published release by tag
        const encodedTag = encodeURIComponent(releaseTag);
        const getRelRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodedTag}`, {
          headers: githubHeaders
        });

        if (getRelRes.ok) {
          releaseData = await getRelRes.json();
        } else if (getRelRes.status === 404) {
          // If 404, the release might be a draft (which cannot be fetched by tag name)
          // or an orphan git tag. Query releases to see if an unlisted or draft release exists.
          try {
            const listRelRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`, {
              headers: githubHeaders
            });
            if (listRelRes.ok) {
              const releasesList = await listRelRes.json();
              if (Array.isArray(releasesList)) {
                const match = releasesList.find((r: any) => r.tag_name === releaseTag);
                if (match) {
                  releaseData = match;
                  // If it's a draft, publish it
                  if (releaseData.draft) {
                    try {
                      const pubRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${releaseData.id}`, {
                        method: 'PATCH',
                        headers: {
                          ...githubHeaders,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ draft: false })
                      });
                      if (pubRes.ok) {
                        releaseData = await pubRes.json();
                      }
                    } catch (draftErr) {
                      console.warn('Failed to publish draft release:', draftErr);
                    }
                  }
                }
              }
            }
          } catch (listErr) {
            console.warn('Error querying repo releases for tag:', listErr);
          }

          if (!releaseData) {
            return NextResponse.json({
              error: `Tag "${releaseTag}" already exists in "${owner}/${repo}", but no GitHub Release is attached to it (or the release was deleted while keeping the git tag). Please choose a new release tag (e.g. "v${versionName}") or delete the orphan tag on GitHub.`
            }, { status: 409 });
          }
        } else {
          const getErrText = await getRelRes.text();
          return NextResponse.json({
            error: `Failed to retrieve existing GitHub release for tag "${releaseTag}": ${getErrText}`
          }, { status: 502 });
        }
      } else {
        // 422 was due to validation error (e.g. tag_name format or target_commitish mismatch)
        const formattedErrors = Array.isArray(errJson?.errors)
          ? errJson.errors.map((e: any) => e.message || `${e.field}: ${e.code}`).join('; ')
          : errJson?.message || errBody;
        return NextResponse.json({
          error: `GitHub Release creation rejected (Validation Error): ${formattedErrors}. Please verify that the release tag format is valid (e.g. "v${versionName}").`
        }, { status: 422 });
      }
    } else {
      const errText = await createRelRes.text();
      return NextResponse.json({ error: `GitHub Release creation failed (${createRelRes.status}): ${errText}` }, { status: 502 });
    }

    const releaseId = releaseData.id;
    const uploadUrlTemplate = releaseData.upload_url; // e.g. https://uploads.github.com/repos/OWNER/REPO/releases/ID/assets{?name,label}
    const cleanUploadUrl = uploadUrlTemplate.replace(/\{.*?\}$/, '') + `?name=${encodeURIComponent(sanitizedFilename)}`;

    // 7. Check if asset already exists in release and delete if necessary before upload
    if (Array.isArray(releaseData.assets)) {
      const existingAsset = releaseData.assets.find((a: any) => a.name === sanitizedFilename);
      if (existingAsset?.id) {
        try {
          await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`, {
            method: 'DELETE',
            headers: githubHeaders
          });
        } catch (e) {
          console.warn('Could not delete existing release asset before re-upload:', e);
        }
      }
    }

    // 8. Upload APK Asset to GitHub Release
    const uploadAssetRes = await fetch(cleanUploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AppVault-Admin-Panel',
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': apkBuffer.length.toString()
      },
      body: apkBuffer
    });

    if (!uploadAssetRes.ok) {
      const assetErr = await uploadAssetRes.text();
      return NextResponse.json({ error: `Failed to upload APK asset to GitHub Release: ${assetErr}` }, { status: 502 });
    }

    const assetData = await uploadAssetRes.json();
    const downloadUrl = assetData.browser_download_url || `https://github.com/${owner}/${repo}/releases/download/${releaseTag}/${sanitizedFilename}`;

    // 7. Write Version Metadata to Firestore
    const versionId = `v_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const versionDocPayload = {
      fields: {
        id: { stringValue: versionId },
        appId: { stringValue: appId },
        versionName: { stringValue: versionName },
        versionCode: { integerValue: versionCode.toString() },
        releaseTag: { stringValue: releaseTag },
        apkUrl: { stringValue: downloadUrl },
        releaseNotes: { stringValue: releaseNotes },
        changelog: { stringValue: changelog },
        apkSize: { integerValue: apkBuffer.length.toString() },
        minAndroidVersion: { integerValue: minAndroidVersion.toString() },
        published: { booleanValue: true },
        createdAt: { timestampValue: nowIso }
      }
    };

    const fsVersionUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/apps/${appId}/versions/${versionId}`;
    const fsVersionRes = await fetch(fsVersionUrl, {
      method: 'POST', // or PATCH
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(versionDocPayload)
    });

    // If document already exists or needs PATCH, handle standard Firestore REST write:
    if (!fsVersionRes.ok) {
      const patchUrl = `${fsVersionUrl}?updateMask.fieldPaths=id&updateMask.fieldPaths=appId&updateMask.fieldPaths=versionName&updateMask.fieldPaths=versionCode&updateMask.fieldPaths=releaseTag&updateMask.fieldPaths=apkUrl&updateMask.fieldPaths=releaseNotes&updateMask.fieldPaths=changelog&updateMask.fieldPaths=apkSize&updateMask.fieldPaths=minAndroidVersion&updateMask.fieldPaths=published&updateMask.fieldPaths=createdAt`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(versionDocPayload)
      });
      if (!patchRes.ok) {
        const fsErr = await patchRes.text();
        return NextResponse.json({ error: `GitHub APK uploaded successfully, but failed to write version to Firestore: ${fsErr}` }, { status: 500 });
      }
    }

    // 8. Update Parent App's Latest Version Metadata in Firestore
    const patchAppUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/apps/${appId}?updateMask.fieldPaths=latestVersionId&updateMask.fieldPaths=latestVersionName&updateMask.fieldPaths=latestVersionCode&updateMask.fieldPaths=minAndroidVersion&updateMask.fieldPaths=apkSize&updateMask.fieldPaths=updatedAt`;
    
    await fetch(patchAppUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          latestVersionId: { stringValue: versionId },
          latestVersionName: { stringValue: versionName },
          latestVersionCode: { integerValue: versionCode.toString() },
          minAndroidVersion: { integerValue: minAndroidVersion.toString() },
          apkSize: { integerValue: apkBuffer.length.toString() },
          updatedAt: { timestampValue: nowIso }
        }
      })
    });

    return NextResponse.json({
      success: true,
      message: 'Version published successfully with GitHub Release asset!',
      versionId,
      apkUrl: downloadUrl,
      releaseUrl: releaseData.html_url
    });

  } catch (error: any) {
    console.error('Error publishing release:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
