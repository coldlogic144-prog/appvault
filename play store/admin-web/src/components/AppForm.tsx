'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { AppItem, DEFAULT_CATEGORIES } from '@/lib/types';

interface AppFormProps {
  initialApp?: AppItem;
  isEdit?: boolean;
}

export default function AppForm({ initialApp, isEdit = false }: AppFormProps) {
  const router = useRouter();

  const workingAppId = initialApp?.id || `app_${Date.now()}`;

  const [name, setName] = useState(initialApp?.name || '');
  const [packageName, setPackageName] = useState(initialApp?.packageName || '');
  const [developer, setDeveloper] = useState(initialApp?.developer || '');
  const [categoryId, setCategoryId] = useState(initialApp?.categoryId || 'education');
  const [shortDescription, setShortDescription] = useState(initialApp?.shortDescription || '');
  const [description, setDescription] = useState(initialApp?.description || '');
  const [githubOwner, setGithubOwner] = useState(initialApp?.githubOwner || '');
  const [githubRepository, setGithubRepository] = useState(initialApp?.githubRepository || '');
  const [website, setWebsite] = useState(initialApp?.website || '');
  const [published, setPublished] = useState(initialApp?.published ?? true);
  const [featured, setFeatured] = useState(initialApp?.featured ?? false);

  const [iconUrl, setIconUrl] = useState(initialApp?.iconUrl || '');
  const [screenshots, setScreenshots] = useState<string[]>(initialApp?.screenshots || []);

  const [iconUploading, setIconUploading] = useState(false);
  const [iconProgress, setIconProgress] = useState(0);
  const [iconStatus, setIconStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [iconError, setIconError] = useState<string | null>(null);

  const [screenshotsUploading, setScreenshotsUploading] = useState(false);
  const [screenshotProgress, setScreenshotProgress] = useState(0);
  const [screenshotsStatus, setScreenshotsStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [screenshotsError, setScreenshotsError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google Drive Icon Upload Handler
  const handleIconFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    setIconUploading(true);
    setIconStatus('uploading');
    setIconError(null);
    setIconProgress(25);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('You must be logged in as an administrator to upload media.');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('appId', workingAppId);
      if (iconUrl) {
        formData.append('previousIconUrl', iconUrl);
      }

      setIconProgress(60);

      const res = await fetch('/api/media/icon', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload icon to Google Drive');
      }

      setIconProgress(100);
      setIconUrl(data.iconUrl);
      setIconStatus('success');
      setIconUploading(false);
    } catch (err: any) {
      console.error('Icon upload error:', err);
      setIconError(err.message || 'Icon upload failed');
      setIconStatus('error');
      setIconUploading(false);
    }
  };

  // Google Drive Screenshots Upload Handler
  const handleScreenshotsFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setScreenshotsUploading(true);
    setScreenshotsStatus('uploading');
    setScreenshotsError(null);
    setScreenshotProgress(20);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('You must be logged in as an administrator to upload media.');
      }

      const formData = new FormData();
      formData.append('appId', workingAppId);
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      setScreenshotProgress(60);

      const res = await fetch('/api/media/screenshots', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload screenshots to Google Drive');
      }

      setScreenshotProgress(100);
      const newUrls: string[] = data.urls || [];
      const updatedScreenshots = [...screenshots, ...newUrls];
      setScreenshots(updatedScreenshots);
      setScreenshotsStatus('success');
      setScreenshotsUploading(false);

      if (isEdit) {
        try {
          const appDocRef = doc(db, 'apps', workingAppId);
          await updateDoc(appDocRef, {
            screenshots: updatedScreenshots,
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn('Could not immediately sync screenshots to Firestore:', e);
        }
      }
    } catch (err: any) {
      console.error('Screenshots upload error:', err);
      setScreenshotsError(err.message || 'Screenshots upload failed');
      setScreenshotsStatus('error');
      setScreenshotsUploading(false);
    }
  };

  const removeScreenshot = async (indexToRemove: number) => {
    const targetUrl = screenshots[indexToRemove];
    const updatedScreenshots = screenshots.filter((_, idx) => idx !== indexToRemove);
    setScreenshots(updatedScreenshots);

    if (isEdit) {
      try {
        const appDocRef = doc(db, 'apps', workingAppId);
        await updateDoc(appDocRef, {
          screenshots: updatedScreenshots,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('Could not sync screenshot removal to Firestore:', e);
      }
    }

    // Asynchronously delete from Google Drive if possible
    if (targetUrl) {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          fetch('/api/media/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`
            },
            body: JSON.stringify({ url: targetUrl, appId: workingAppId })
          }).catch(console.warn);
        }
      } catch (e) {
        console.warn('Could not trigger Google Drive screenshot deletion:', e);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Application Name is required.');
      return;
    }
    if (!packageName.trim()) {
      setError('Package Name is required.');
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName.trim())) {
      setError('Invalid package name format (e.g. com.company.app).');
      return;
    }
    if (!description.trim() && !shortDescription.trim()) {
      setError('Description is required.');
      return;
    }

    setSaving(true);

    try {
      const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
      const appDocRef = doc(db, 'apps', workingAppId);

      const appData = {
        name: name.trim(),
        packageName: packageName.trim(),
        slug,
        developer: developer.trim(),
        categoryId,
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        githubOwner: githubOwner.trim(),
        githubRepository: githubRepository.trim(),
        website: website.trim(),
        iconUrl: iconUrl.trim(),
        screenshots,
        published,
        featured,
        updatedAt: serverTimestamp()
      };

      if (isEdit) {
        await updateDoc(appDocRef, appData);
      } else {
        await setDoc(appDocRef, {
          ...appData,
          id: workingAppId,
          downloadCount: 0,
          latestVersionId: '',
          latestVersionName: '1.0.0',
          latestVersionCode: 1,
          minAndroidVersion: 26,
          apkSize: 0,
          createdAt: serverTimestamp()
        }, { merge: true });
      }

      setSaving(false);
      router.push('/apps');
    } catch (err: any) {
      console.error('Error saving app:', err);
      setError(`Failed to save application: ${err.message}`);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          color: 'var(--danger)',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* Basic Info Card */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>General Information</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Application Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. MMMUT ERP"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Package Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. com.mmmut.erp"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              disabled={isEdit}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Developer / Publisher Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. MMMUT Tech Club"
              value={developer}
              onChange={(e) => setDeveloper(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Short Description</label>
          <input
            type="text"
            className="form-input"
            placeholder="Single-sentence summary of the app"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Full Description *</label>
          <textarea
            className="form-textarea"
            placeholder="Complete description of features, modules, and functionality..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Website (Optional)</label>
          <input
            type="url"
            className="form-input"
            placeholder="https://example.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </div>

      {/* GitHub Repository Mapping Card */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>GitHub Releases Repository</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Configure where APK binary releases for this specific application are hosted.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">GitHub Owner / Organization</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. coldlogic144 or mmmut"
              value={githubOwner}
              onChange={(e) => setGithubOwner(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">GitHub Repository Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. mmmut-erp"
              value={githubRepository}
              onChange={(e) => setGithubRepository(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Images & Media Card */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Application Media (Google Drive Storage)</h3>

        {/* App Icon Upload */}
        <div style={{ marginBottom: '28px' }}>
          <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Application Icon</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {iconUrl ? (
              <img
                src={iconUrl}
                alt="App Icon"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '18px',
                  objectFit: 'cover',
                  border: '1px solid var(--border)'
                }}
              />
            ) : (
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '18px',
                backgroundColor: 'var(--bg-surface-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                border: '1px dashed var(--border)'
              }}>
                🖼️
              </div>
            )}

            <div style={{ flex: 1 }}>
              <input
                type="file"
                id="icon-upload"
                accept="image/*"
                onChange={handleIconFile}
                disabled={iconUploading}
                style={{ display: 'none' }}
              />
              <label htmlFor="icon-upload" className="btn btn-secondary" style={{ cursor: iconUploading ? 'not-allowed' : 'pointer' }}>
                {iconUploading ? 'Uploading to Drive...' : (iconUrl ? 'Choose New Icon' : 'Choose Icon File')}
              </label>

              {/* Upload states */}
              <div style={{ marginTop: '10px' }}>
                {iconStatus === 'uploading' && (
                  <div>
                    <div className="progress-container">
                      <div className="progress-bar" style={{ width: `${iconProgress}%` }} />
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--primary)' }}>Uploading to Google Drive... {iconProgress}%</span>
                  </div>
                )}
                {iconStatus === 'success' && (
                  <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                    Uploaded ✓ (Direct Google Drive media URL saved)
                  </span>
                )}
                {iconStatus === 'error' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#ef4444' }}>
                      Failed — {iconError || 'Upload error'}
                    </span>
                    <label htmlFor="icon-upload" style={{ fontSize: '12px', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}>
                      Retry
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Screenshots Upload */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>
              Screenshots Gallery ({screenshots.length})
            </label>
            <label htmlFor="screenshots-upload" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '13px', cursor: 'pointer' }}>
              + Add Screenshots
            </label>
          </div>

          <input
            type="file"
            id="screenshots-upload"
            accept="image/*"
            multiple
            onChange={handleScreenshotsFiles}
            disabled={screenshotsUploading}
            style={{ display: 'none' }}
          />

          <label htmlFor="screenshots-upload" className="dropzone" style={{ cursor: screenshotsUploading ? 'not-allowed' : 'pointer' }}>
            <span style={{ fontSize: '28px' }}>📸</span>
            <span style={{ fontWeight: 600 }}>Click to Select or Drag Screenshots</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Upload JPEG, PNG, or WebP screenshot images to Google Drive</span>
          </label>

          {/* Screenshots Upload states */}
          <div style={{ marginTop: '10px' }}>
            {screenshotsStatus === 'uploading' && (
              <div>
                <div className="progress-container">
                  <div className="progress-bar" style={{ width: `${screenshotProgress}%` }} />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--primary)' }}>Uploading screenshots to Google Drive... {screenshotProgress}%</span>
              </div>
            )}
            {screenshotsStatus === 'success' && (
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                Uploaded ✓ (Screenshots stored on Google Drive)
              </span>
            )}
            {screenshotsStatus === 'error' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#ef4444' }}>
                  Failed — {screenshotsError || 'Upload error'}
                </span>
                <label htmlFor="screenshots-upload" style={{ fontSize: '12px', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}>
                  Retry
                </label>
              </div>
            )}
          </div>

          {screenshots.length > 0 && (
            <div className="preview-grid" style={{ marginTop: '16px' }}>
              {screenshots.map((url, idx) => (
                <div key={idx} className="preview-thumb">
                  <img src={url} alt={`Screenshot ${idx + 1}`} />
                  <button
                    type="button"
                    className="preview-remove"
                    onClick={() => removeScreenshot(idx)}
                    title="Remove Screenshot"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Visibility & Settings Card */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Published Status</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              When enabled, application is visible to public AppVault Android clients.
            </div>
          </div>
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Featured on Store Home</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Displays in hero banner on the Android store home screen.
            </div>
          </div>
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
          />
        </div>
      </div>

      {/* Submit Button */}
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '12px' }}>
        <button
          type="button"
          onClick={() => router.push('/apps')}
          className="btn btn-secondary"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ minWidth: '160px' }}
          disabled={saving || iconUploading || screenshotsUploading}
        >
          {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Application')}
        </button>
      </div>
    </form>
  );
}
